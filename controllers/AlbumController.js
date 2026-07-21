import crypto from "crypto";
import Album from "../models/album.js";
import PhotoSelectionProject from "../models/photoSelectionProject.js";
import Photo from "../models/photo.js";

// Create a new digital album
export const createAlbum = async (req, res) => {
  try {
    const { projectId, albumTitle, clientName, coverPhoto, photos, useSelectedPhotos, theme } = req.body;
    const vendorId = req.user.id;

    if (!albumTitle || !clientName) {
      return res.status(400).json({ message: "Album title and client name are required", success: false });
    }

    let finalPhotos = Array.isArray(photos) ? photos : [];

    // If linked to project and useSelectedPhotos is true, pull selected photos from DB
    if (projectId && (useSelectedPhotos || finalPhotos.length === 0)) {
      const project = await PhotoSelectionProject.findOne({ _id: projectId, vendorId });
      if (project && project.selectedPhotoIds && project.selectedPhotoIds.length > 0) {
        const selectedPhotos = await Photo.find({ _id: { $in: project.selectedPhotoIds } })
          .populate("folderId", "folderName");

        finalPhotos = selectedPhotos.map((photo) => ({
          url: photo.previewUrl,
          originalFileName: photo.originalFileName || "",
          folderName: photo.folderId?.folderName || "General",
          caption: photo.originalBaseName || "",
        }));
      }
    }

    if (finalPhotos.length === 0) {
      return res.status(400).json({ message: "At least one photo is required to create an album", success: false });
    }

    const albumToken = crypto.randomBytes(16).toString("hex");
    const chosenCoverPhoto = coverPhoto || finalPhotos[0]?.url || "";

    const album = new Album({
      vendorId,
      projectId: projectId || null,
      albumTitle,
      clientName,
      coverPhoto: chosenCoverPhoto,
      photos: finalPhotos,
      albumToken,
      theme: theme || "classic",
    });

    await album.save();

    return res.status(201).json({
      success: true,
      message: "Album created successfully",
      album,
    });
  } catch (error) {
    console.error("createAlbum error:", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Public: Get album details by token
export const getAlbumByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const album = await Album.findOne({ albumToken: token, status: "active" });
    if (!album) {
      return res.status(404).json({ message: "Album not found", success: false });
    }

    return res.status(200).json({
      success: true,
      album,
    });
  } catch (error) {
    console.error("getAlbumByToken error:", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Vendor: Get all albums for a specific project
export const getProjectAlbums = async (req, res) => {
  try {
    const { projectId } = req.params;
    const vendorId = req.user.id;

    const albums = await Album.find({ projectId, vendorId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      albums,
    });
  } catch (error) {
    console.error("getProjectAlbums error:", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Vendor: Get all albums created by vendor
export const getVendorAlbums = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const albums = await Album.find({ vendorId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      albums,
    });
  } catch (error) {
    console.error("getVendorAlbums error:", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

// Vendor: Delete album
export const deleteAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const vendorId = req.user.id;

    const album = await Album.findOneAndDelete({ _id: albumId, vendorId });
    if (!album) {
      return res.status(404).json({ message: "Album not found", success: false });
    }

    return res.status(200).json({
      success: true,
      message: "Album deleted successfully",
    });
  } catch (error) {
    console.error("deleteAlbum error:", error.message);
    return res.status(500).json({ message: "Server error", success: false });
  }
};
