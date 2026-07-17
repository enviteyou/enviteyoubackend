import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PhotoSelectionProject",
    required: true,
  },
  originalFileName: {
    type: String,
    required: true,
  },
  originalBaseName: {
    type: String,
    required: true,
  },
  previewUrl: {
    type: String,
    required: true,
  },
  cloudinaryPublicId: {
    type: String,
    required: true,
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProjectFolder",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

photoSchema.index({ projectId: 1 });
photoSchema.index({ folderId: 1 });

const Photo = mongoose.model("Photo", photoSchema);
export default Photo;
