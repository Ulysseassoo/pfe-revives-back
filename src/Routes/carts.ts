import { Shoe, User } from "@prisma/client";
import express from "express";
import { validationResult } from "express-validator";
import { db } from "../Utils/db.server";
import authMiddleware from "../Middleware/auth.middleware";
import adminMiddleware from "../Middleware/admin.middleware";
import { orderCreate } from "../Validator/orderValidator";
import { cartUpdate } from "../Validator/cartValidator";

interface ShoeWithQuantity extends Shoe {
	quantity: number;
}

const router = express.Router();

const formatProducts = async (products: ShoeWithQuantity[]) => {
	const productIds = products.map((product) => product.shoe_id);

	// Fetch the actual product information from the database based on the IDs
	const fetchedProducts = await db.shoe.findMany({
		where: {
			shoe_id: {
				in: productIds,
			},
		},
	});

	const mergedProducts: ShoeWithQuantity[] = fetchedProducts.map((product: Shoe) => {
		const quantity = products.find((p: ShoeWithQuantity) => p.shoe_id === product.shoe_id)?.quantity || 0;
		return { ...product, quantity };
	});

	return mergedProducts;
};

// -------------------------------------------------------------------------- ROUTES -------------------------------------------------------------

router.post("/carts", authMiddleware, async (req: express.Request, res: express.Response) => {
	try {
		const user = req.user as User;

		const cart = await db.cart.create({
			data: {
				userId: user.user_id,
				products: "",
			},
		});

		return res.json({ status: 201, data: cart });
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Error creating your cart",
		});
	}
});

router.get("/carts", authMiddleware, adminMiddleware, async (req: express.Request, res: express.Response) => {
	try {
		const user = req.user as User;

		const cart = await db.cart.findUnique({
			where: {
				userId: user.user_id,
			},
		});

		return res.json({ status: 200, data: cart });
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Error getting your cart",
		});
	}
});

router.put("/carts/:id", authMiddleware, cartUpdate, async (req: express.Request, res: express.Response) => {
	try {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			return res.status(401).send({
				status: 401,
				message: errors,
			});
		}

		const user = req.user as User;

		const cart = await db.cart.findUnique({
			where: {
				userId: user.user_id,
			},
		});

		if (cart) {
			const products: ShoeWithQuantity[] = JSON.parse(req.body.products);
			const formattedProducts = await formatProducts(products);
			const updatedCart = await db.cart.update({
				where: {
					id: cart.id,
				},
				data: {
					products: JSON.stringify(formattedProducts),
				},
			});
			return res.json({ status: 200, data: updatedCart });
		} else {
			return res.status(401).send({
				status: 401,
				message: "Cart not found",
			});
		}
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Error with your cart",
		});
	}
});

export default router;
