import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
	{
		category: {
			type: String,
			required: true,
			trim: true,
		},
		pricing: {
			type: String,
			trim: true,
		},

		sellPrice: {
			type: Number,
			required: true,
		},
		vendorPrice: {
			type: Number,
			required: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			required: true,
			trim: true,
		},
		featuredImage: {
			type: String,
			required: true,
		},

		templateId: {
			type: String,
			trim: true,
			index: true,
		},
		allowedTabs: {
			type: [String],
			default: ["Essentials", "Invitation", "Events", "Story", "Gallery", "Info", "RSVP", "Music"],
		},
	},
	{
		timestamps: true,
	}
);

const Template = mongoose.model("Template", templateSchema);

export default Template;
