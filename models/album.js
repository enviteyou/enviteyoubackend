import mongoose from "mongoose";

const albumSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PhotoSelectionProject",
    required: false,
  },
  albumTitle: {
    type: String,
    required: true,
  },
  clientName: {
    type: String,
    required: true,
  },
  coverPhoto: {
    type: String,
    default: "",
  },
  photos: [
    {
      url: { type: String, required: true },
      caption: { type: String, default: "" },
      originalFileName: { type: String, default: "" },
      folderName: { type: String, default: "" },
    },
  ],
  albumToken: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["active", "draft"],
    default: "active",
  },
  theme: {
    type: String,
    default: "classic",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Album = mongoose.model("Album", albumSchema);
export default Album;
