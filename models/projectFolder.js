import mongoose from "mongoose";

const projectFolderSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PhotoSelectionProject",
    required: true,
  },
  folderName: {
    type: String,
    required: true,
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
});

projectFolderSchema.index({ projectId: 1, displayOrder: 1 });

const ProjectFolder = mongoose.model("ProjectFolder", projectFolderSchema);
export default ProjectFolder;
