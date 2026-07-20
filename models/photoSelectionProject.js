import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  projectName: {
    type: String,
    required: true,
  },
  clientName: {
    type: String,
    required: true,
  },
  clientEmail: {
    type: String,
    required: false,
  },
  clientPhone: {
    type: String,
    required: false,
  },
  enableLimitAlert: {
    type: Boolean,
    default: true,
  },
  selectionLimit: {
    type: Number,
    required: true,
    default: 100,
  },
  selectionToken: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active",
  },
  selectedPhotoIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Photo",
  }],
  submittedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PhotoSelectionProject = mongoose.model("PhotoSelectionProject", projectSchema);
export default PhotoSelectionProject;
