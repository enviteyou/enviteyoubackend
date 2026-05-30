import Template from "../models/template.js";
import cloudinary from "../config/cloudinary.js";

async function getNextTemplateId() {
  const templates = await Template.find({ templateId: { $exists: true, $nin: [null, ""] } }).select("templateId").lean();
  const maxTemplateId = templates.reduce((max, currentTemplate) => {
    const numericTemplateId = Number(currentTemplate.templateId);
    return Number.isFinite(numericTemplateId) && numericTemplateId > max ? numericTemplateId : max;
  }, 0);

  return String(maxTemplateId + 1);
}

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

async function getImageUrlFromRequest(req, fieldName, fallbackUrl = "") {
  const uploadedFile = req.files?.[fieldName]?.[0];

  if (uploadedFile) {
    const uploadResult = await uploadImage(uploadedFile);
    return uploadResult.secure_url;
  }

  const bodyValue = String(req.body?.[fieldName] || "").trim();
  return bodyValue || fallbackUrl;
}

export const createTemplate = async (req, res) => {
  try {
    const featuredImageFile = req.files?.featuredImage?.[0] || req.file;

    if (!featuredImageFile) {
      return res.status(400).json({ success: false, message: "featuredImage is required" });
    }

    const uploadResult = await uploadImage(featuredImageFile);
    const templateId = String(req.body.templateId || (await getNextTemplateId())).trim();
    const secondaryImage = await getImageUrlFromRequest(req, "secondaryImage", uploadResult.secure_url);

    const template = await Template.create({
      templateId,
      category: req.body.category,
      pricing: req.body.pricing,
      regularPrice: Number(req.body.regularPrice),
      sellPrice: Number(req.body.sellPrice),
      vendorPrice: Number(req.body.vendorPrice),
      title: req.body.title,
      description: req.body.description,
      featuredImage: uploadResult.secure_url,
      secondaryImage,
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
    const template = await Template.findOne({
      $or: [{ _id: req.params.id }, { templateId: req.params.id }],
    });
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
    if (req.files?.featuredImage?.[0] || req.file) {
      const uploadResult = await uploadImage(req.files?.featuredImage?.[0] || req.file);
      imageUrl = uploadResult.secure_url;
    }

    const secondaryImage = req.files?.secondaryImage?.[0]
      ? (await uploadImage(req.files.secondaryImage[0])).secure_url
      : String(req.body.secondaryImage || template.secondaryImage || template.featuredImage || "").trim();

    const updateTemplate = await Template.findByIdAndUpdate(
      req.params.id,
      {
        templateId: req.body.templateId !== undefined && String(req.body.templateId).trim() ? String(req.body.templateId).trim() : template.templateId,
        category: req.body.category,
        pricing: req.body.pricing,
        regularPrice: req.body.regularPrice !== undefined ? Number(req.body.regularPrice) : template.regularPrice,
        sellPrice: req.body.sellPrice !== undefined ? Number(req.body.sellPrice) : template.sellPrice,
        vendorPrice: req.body.vendorPrice !== undefined ? Number(req.body.vendorPrice) : template.vendorPrice,
        title: req.body.title,
        description: req.body.description,
        featuredImage: imageUrl,
        secondaryImage,
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