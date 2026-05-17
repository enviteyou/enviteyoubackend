import Template from "../models/template.js";
import cloudinary from "../config/cloudinary.js";

function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    cloudinary.uploader.upload(
      dataURI,
      {
        folder: "Template/images",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
  });
}

export const createTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "featuredImage is required" });
    }

    const uploadResult = await uploadImage(req.file);

    const template = await Template.create({
      category: req.body.category,
      pricing: req.body.pricing,
      regularPrice: Number(req.body.regularPrice),
      sellPrice: Number(req.body.sellPrice),
      vendorPrice: Number(req.body.vendorPrice),
      title: req.body.title,
      description: req.body.description,
      featuredImage: uploadResult.secure_url,
    });

    return res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template,
    });
  } catch (error) {
    console.log("Error creating template:", error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getTemplates = async (_req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    return res.status(200).json(templates);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found", success: false });
    }

    return res.status(200).json(template);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found", success: false });
    }

    let imageUrl = template.featuredImage;
    if (req.file) {
      const uploadResult = await uploadImage(req.file);
      imageUrl = uploadResult.secure_url;
    }

    const updateTemplate = await Template.findByIdAndUpdate(
      req.params.id,
      {
        category: req.body.category,
        pricing: req.body.pricing,
        regularPrice: req.body.regularPrice !== undefined ? Number(req.body.regularPrice) : template.regularPrice,
        sellPrice: req.body.sellPrice !== undefined ? Number(req.body.sellPrice) : template.sellPrice,
        vendorPrice: req.body.vendorPrice !== undefined ? Number(req.body.vendorPrice) : template.vendorPrice,
        title: req.body.title,
        description: req.body.description,
        featuredImage: imageUrl,
      },
      { new: true }
    );

    return res.status(200).json({ message: "Template updated successfully", success: true, updateTemplate });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const updateTemplate = await Template.findByIdAndDelete(req.params.id);
    if (!updateTemplate) {
      return res.status(404).json({ message: "Template not found", success: false });
    }

    return res.status(200).json({ message: "Template deleted successfully", success: true, updateTemplate });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};