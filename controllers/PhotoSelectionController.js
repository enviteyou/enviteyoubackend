import crypto from "crypto";
import PhotoSelectionProject from "../models/photoSelectionProject.js";
import Photo from "../models/photo.js";
import cloudinary from "../config/cloudinary.js";

// ==========================================
// VENDOR CONTROLLERS
// ==========================================

// Create a new project
export const createProject = async (req, res) => {
  try {
    const { projectName, clientName, clientEmail, selectionLimit } = req.body;
    const vendorId = req.user.id;

    if (!projectName || !clientName || !clientEmail || !selectionLimit) {
      return res.status(400).json({ message: "All fields are required", success: false });
    }

    const selectionToken = crypto.randomBytes(16).toString("hex");

    const project = new PhotoSelectionProject({
      vendorId,
      projectName,
      clientName,
      clientEmail,
      selectionLimit,
      selectionToken,
    });

    await project.save();

    return res.status(201).json({ success: true, project });
  } catch (error) {
    console.error("createProject error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// List all projects for a vendor
export const getProjects = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const projects = await PhotoSelectionProject.find({ vendorId }).sort({ createdAt: -1 });

    // Enforce selected count stats
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const totalPhotos = await Photo.countDocuments({ projectId: project._id });
        return {
          ...project.toObject(),
          totalPhotos,
          selectedCount: project.selectedPhotoIds.length,
        };
      })
    );

    return res.status(200).json({ success: true, projects: projectsWithStats });
  } catch (error) {
    console.error("getProjects error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get single project details (vendor view)
export const getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const vendorId = req.user.id;

    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const totalPhotos = await Photo.countDocuments({ projectId: project._id });

    return res.status(200).json({
      success: true,
      project: {
        ...project.toObject(),
        totalPhotos,
        selectedCount: project.selectedPhotoIds.length,
      },
    });
  } catch (error) {
    console.error("getProjectDetails error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get paginated list of photos for a project (vendor view)
export const getProjectPhotos = async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const vendorId = req.user.id;

    // Check project ownership
    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const totalCount = await Photo.countDocuments({ projectId });
    const photos = await Photo.find({ projectId }).skip(skip).limit(limit).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      photos,
      totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("getProjectPhotos error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Bulk add photos metadata
export const bulkAddPhotos = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { photos } = req.body; // Array of { originalFileName, originalBaseName, previewUrl, cloudinaryPublicId }
    const vendorId = req.user.id;

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ message: "Photos array is required", success: false });
    }

    // Check project ownership
    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const mappedPhotos = photos.map((p) => ({
      projectId,
      originalFileName: p.originalFileName,
      originalBaseName: p.originalBaseName,
      previewUrl: p.previewUrl,
      cloudinaryPublicId: p.cloudinaryPublicId,
    }));

    const result = await Photo.insertMany(mappedPhotos);

    return res.status(201).json({
      success: true,
      message: "Photos logged successfully",
      count: result.length,
    });
  } catch (error) {
    console.error("bulkAddPhotos error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Generate Cloudinary secure signature
export const generateCloudinarySignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `enviteyou/projects/${req.user.id}`;

    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    return res.status(200).json({
      success: true,
      signature,
      timestamp,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error("generateCloudinarySignature error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get selected photos details for copying (names only)
export const getSelectedPhotosForCopy = async (req, res) => {
  try {
    const { projectId } = req.params;
    const vendorId = req.user.id;

    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    // Find all files matching the selected IDs
    const selectedPhotos = await Photo.find({
      _id: { $in: project.selectedPhotoIds },
    }).select("originalFileName originalBaseName");

    return res.status(200).json({ success: true, selectedPhotos, project });
  } catch (error) {
    console.error("getSelectedPhotosForCopy error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// ==========================================
// CLIENT CONTROLLERS (PUBLIC ACCESSIBLE)
// ==========================================

// Get project details for client view via selectionToken
export const getClientProject = async (req, res) => {
  try {
    const { token } = req.params;

    const project = await PhotoSelectionProject.findOne({ selectionToken: token });
    if (!project) {
      return res.status(404).json({ message: "Project link is invalid or expired", success: false });
    }

    const totalPhotos = await Photo.countDocuments({ projectId: project._id });

    return res.status(200).json({
      success: true,
      project: {
        projectName: project.projectName,
        clientName: project.clientName,
        selectionLimit: project.selectionLimit,
        status: project.status,
        submittedAt: project.submittedAt,
        totalPhotos,
        selectedCount: project.selectedPhotoIds.length,
        selectedPhotoIds: project.selectedPhotoIds, // helpful to resume selections
      },
    });
  } catch (error) {
    console.error("getClientProject error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get paginated photos for client view via selectionToken
export const getClientPhotos = async (req, res) => {
  try {
    const { token } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const project = await PhotoSelectionProject.findOne({ selectionToken: token });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const totalCount = await Photo.countDocuments({ projectId: project._id });
    const photos = await Photo.find({ projectId: project._id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      photos,
      totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("getClientPhotos error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Client submits selection
export const submitClientSelection = async (req, res) => {
  try {
    const { token } = req.params;
    const { selectedPhotoIds } = req.body; // Array of Photo Mongo IDs

    if (!Array.isArray(selectedPhotoIds)) {
      return res.status(400).json({ message: "selectedPhotoIds must be an array", success: false });
    }

    const project = await PhotoSelectionProject.findOne({ selectionToken: token });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    if (selectedPhotoIds.length > project.selectionLimit) {
      return res.status(400).json({
        message: `Selection limit exceeded. Maximum limit is ${project.selectionLimit} photos.`,
        success: false,
      });
    }

    // Verify all photo IDs belong to this project
    const count = await Photo.countDocuments({
      _id: { $in: selectedPhotoIds },
      projectId: project._id,
    });

    if (count !== selectedPhotoIds.length) {
      return res.status(400).json({ message: "Some selected photos are invalid or belong to other projects", success: false });
    }

    project.selectedPhotoIds = selectedPhotoIds;
    project.status = "completed";
    project.submittedAt = new Date();

    await project.save();

    return res.status(200).json({ success: true, message: "Selection submitted successfully" });
  } catch (error) {
    console.error("submitClientSelection error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Delete a project and remove all its files from Cloudinary and DB
export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const vendorId = req.user.id;

    // 1. Find the project and verify ownership
    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    // 2. Find all photos associated with this project
    const photos = await Photo.find({ projectId });

    // 3. Delete photos from Cloudinary
    const publicIds = photos.map((p) => p.cloudinaryPublicId).filter(Boolean);
    if (publicIds.length > 0) {
      try {
        const chunks = [];
        for (let i = 0; i < publicIds.length; i += 100) {
          chunks.push(publicIds.slice(i, i + 100));
        }
        await Promise.all(chunks.map((chunk) => cloudinary.api.delete_resources(chunk)));
      } catch (cloudinaryError) {
        console.error("Cloudinary deletion failed during project delete:", cloudinaryError.message);
      }
    }

    // 4. Delete photo records from database
    await Photo.deleteMany({ projectId });

    // 5. Delete the project record from database
    await PhotoSelectionProject.deleteOne({ _id: projectId });

    return res.status(200).json({ success: true, message: "Project and associated images deleted successfully" });
  } catch (error) {
    console.error("deleteProject error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};
