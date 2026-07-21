import crypto from "crypto";
import PhotoSelectionProject from "../models/photoSelectionProject.js";
import Photo from "../models/photo.js";
import ProjectFolder from "../models/projectFolder.js";
import cloudinary from "../config/cloudinary.js";

// ==========================================
// VENDOR CONTROLLERS
// ==========================================

// Create a new project
export const createProject = async (req, res) => {
  try {
    const { projectName, clientName, clientEmail, clientPhone, enableLimitAlert, selectionLimit } = req.body;
    const vendorId = req.user.id;

    if (!projectName || !clientName || !selectionLimit) {
      return res.status(400).json({ message: "Project name, client name, and selection limit are required", success: false });
    }

    const selectionToken = crypto.randomBytes(16).toString("hex");

    const project = new PhotoSelectionProject({
      vendorId,
      projectName,
      clientName,
      clientEmail,
      clientPhone,
      enableLimitAlert: enableLimitAlert !== undefined ? enableLimitAlert : true,
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
    const { photos, folderId } = req.body; // Array of { originalFileName, originalBaseName, previewUrl, cloudinaryPublicId }
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
      folderId,
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
    const { projectId, folderId } = req.body || {};
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    let folder = `enviteyou/projects/${req.user.id}`;
    if (projectId && folderId) {
      const dbFolder = await ProjectFolder.findOne({ _id: folderId, projectId });
      if (dbFolder) {
        // Sanitize folder name for Cloudinary
        const safeFolderName = dbFolder.folderName.replace(/[^a-zA-Z0-9_\-\/]/g, "_");
        folder = `enviteyou/projects/${projectId}/${safeFolderName}`;
      }
    }

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

    // Find all files matching the selected IDs, populating folderName
    const selectedPhotos = await Photo.find({
      _id: { $in: project.selectedPhotoIds },
    }).populate("folderId", "folderName");

    const mappedPhotos = selectedPhotos.map((photo) => ({
      originalFileName: photo.originalFileName,
      originalBaseName: photo.originalBaseName,
      folderName: photo.folderId ? photo.folderId.folderName : "Unassigned",
    }));

    return res.status(200).json({ success: true, selectedPhotos: mappedPhotos, project });
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
        enableLimitAlert: project.enableLimitAlert !== false,
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
    const { folderId, onlySelected } = req.query; // Add onlySelected
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const project = await PhotoSelectionProject.findOne({ selectionToken: token });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const query = { projectId: project._id };
    if (onlySelected === "true") {
      query._id = { $in: project.selectedPhotoIds };
    } else if (folderId) {
      query.folderId = folderId;
    }

    const totalCount = await Photo.countDocuments(query);
    const photos = await Photo.find(query)
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

    // Delete folder records from database
    await ProjectFolder.deleteMany({ projectId });

    // 5. Delete the project record from database
    await PhotoSelectionProject.deleteOne({ _id: projectId });

    return res.status(200).json({ success: true, message: "Project and associated images deleted successfully" });
  } catch (error) {
    console.error("deleteProject error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Create a new folder
export const createFolder = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { folderName } = req.body;
    const vendorId = req.user.id;

    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ message: "Folder name is required", success: false });
    }

    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    // Check if duplicate name in project
    const existing = await ProjectFolder.findOne({ projectId, folderName: { $regex: new RegExp(`^${folderName.trim()}$`, "i") } });
    if (existing) {
      return res.status(200).json({ success: true, folder: existing, message: "Folder already exists" });
    }

    // Get max displayOrder
    const lastFolder = await ProjectFolder.findOne({ projectId }).sort({ displayOrder: -1 });
    const nextOrder = lastFolder ? lastFolder.displayOrder + 1 : 0;

    const folder = new ProjectFolder({
      projectId,
      folderName: folderName.trim(),
      displayOrder: nextOrder,
    });

    await folder.save();

    return res.status(201).json({ success: true, folder });
  } catch (error) {
    console.error("createFolder error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Rename a folder
export const renameFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { folderName } = req.body;
    const vendorId = req.user.id;

    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ message: "Folder name is required", success: false });
    }

    const folder = await ProjectFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found", success: false });
    }

    // Check project ownership
    const project = await PhotoSelectionProject.findOne({ _id: folder.projectId, vendorId });
    if (!project) {
      return res.status(403).json({ message: "Not authorized", success: false });
    }

    // Check if duplicate name in project (excluding current folder)
    const existing = await ProjectFolder.findOne({
      projectId: folder.projectId,
      _id: { $ne: folderId },
      folderName: { $regex: new RegExp(`^${folderName.trim()}$`, "i") }
    });
    if (existing) {
      return res.status(400).json({ message: "Another folder with this name already exists", success: false });
    }

    folder.folderName = folderName.trim();
    await folder.save();

    return res.status(200).json({ success: true, folder });
  } catch (error) {
    console.error("renameFolder error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Delete empty folder
export const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const vendorId = req.user.id;

    const folder = await ProjectFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found", success: false });
    }

    // Check project ownership
    const project = await PhotoSelectionProject.findOne({ _id: folder.projectId, vendorId });
    if (!project) {
      return res.status(403).json({ message: "Not authorized", success: false });
    }

    // Check if folder contains any photos
    const photosCount = await Photo.countDocuments({ folderId });
    if (photosCount > 0) {
      return res.status(400).json({
        message: "Cannot delete folder because it contains photos. Please delete or move the photos first.",
        success: false
      });
    }

    await ProjectFolder.deleteOne({ _id: folderId });

    return res.status(200).json({ success: true, message: "Folder deleted successfully" });
  } catch (error) {
    console.error("deleteFolder error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get folders for a project (with photo counts)
export const getProjectFolders = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await PhotoSelectionProject.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const folders = await ProjectFolder.find({ projectId }).sort({ displayOrder: 1 });
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const totalPhotos = await Photo.countDocuments({ folderId: folder._id });
        return {
          ...folder.toObject(),
          totalPhotos,
        };
      })
    );

    return res.status(200).json({ success: true, folders: foldersWithCounts });
  } catch (error) {
    console.error("getProjectFolders error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get folders for a client project via selection token
export const getClientProjectFolders = async (req, res) => {
  try {
    const { token } = req.params;

    const project = await PhotoSelectionProject.findOne({ selectionToken: token });
    if (!project) {
      return res.status(404).json({ message: "Project link is invalid or expired", success: false });
    }

    const folders = await ProjectFolder.find({ projectId: project._id }).sort({ displayOrder: 1 });
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const totalPhotos = await Photo.countDocuments({ folderId: folder._id });
        return {
          ...folder.toObject(),
          totalPhotos,
        };
      })
    );

    return res.status(200).json({ success: true, folders: foldersWithCounts, project });
  } catch (error) {
    console.error("getClientProjectFolders error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Get folder-wise selection summary
export const getProjectSelectionSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const vendorId = req.user.id;

    const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
    if (!project) {
      return res.status(404).json({ message: "Project not found", success: false });
    }

    const folders = await ProjectFolder.find({ projectId }).sort({ displayOrder: 1 });

    const selectedPhotos = await Photo.find({
      _id: { $in: project.selectedPhotoIds },
    }).select("folderId");

    const folderCounts = {};
    selectedPhotos.forEach((photo) => {
      const fId = photo.folderId ? photo.folderId.toString() : "unassigned";
      folderCounts[fId] = (folderCounts[fId] || 0) + 1;
    });

    const summary = folders.map((folder) => {
      return {
        folderId: folder._id,
        folderName: folder.folderName,
        selectedCount: folderCounts[folder._id.toString()] || 0,
      };
    });

    if (folderCounts["unassigned"]) {
      summary.push({
        folderId: "unassigned",
        folderName: "Unassigned",
        selectedCount: folderCounts["unassigned"],
      });
    }

    return res.status(200).json({
      success: true,
      summary,
      totalSelected: project.selectedPhotoIds.length,
      selectionLimit: project.selectionLimit,
    });
  } catch (error) {
    console.error("getProjectSelectionSummary error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Client saves selection progress (without completing project)
export const saveClientProgress = async (req, res) => {
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



    // Verify all photo IDs belong to this project
    const count = await Photo.countDocuments({
      _id: { $in: selectedPhotoIds },
      projectId: project._id,
    });

    if (count !== selectedPhotoIds.length) {
      return res.status(400).json({ message: "Some selected photos are invalid or belong to other projects", success: false });
    }

    project.selectedPhotoIds = selectedPhotoIds;
    await project.save();

    return res.status(200).json({ success: true, message: "Progress saved successfully" });
  } catch (error) {
    console.error("saveClientProgress error", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};
