import express from "express";
import { getReviews, createReview } from "../controllers/ReviewController.js";
import authUser from "../middleware/authenticate.js";

const router = express.Router();

// GET /reviews - Get reviews & stats
router.get("/", getReviews);

// POST /reviews - Create a review (Requires authentication)
router.post("/", authUser, createReview);

export default router;
