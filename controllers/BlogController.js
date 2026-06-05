import Blog from "../models/blog.js";
import cloudinary from "../config/cloudinary.js";

function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    cloudinary.uploader.upload(
      dataURI,
      {
        folder: "Blog/images",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
  });
}

export const createBlog = async (req, res) => {
  try {
    const featuredImageFile = req.files?.featuredImage?.[0] || req.file;

    if (!featuredImageFile) {
      return res.status(400).json({ success: false, message: "featuredImage is required" });
    }

    const uploadResult = await uploadImage(featuredImageFile);

    const blog = await Blog.create({
      title: req.body.title,
      shortDescription: req.body.shortDescription,
      description: req.body.description,
      featuredImage: uploadResult.secure_url,
      meta_title: req.body.meta_title,
      meta_description: req.body.meta_description,
    });

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error creating blog:", error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getBlogs = async (_req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    return res.status(200).json(blogs);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found", success: false });
    }
    return res.status(200).json(blog);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found", success: false });
    }

    let imageUrl = blog.featuredImage;
    if (req.files?.featuredImage?.[0] || req.file) {
      const uploadResult = await uploadImage(req.files?.featuredImage?.[0] || req.file);
      imageUrl = uploadResult.secure_url;
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title !== undefined ? req.body.title : blog.title,
        shortDescription: req.body.shortDescription !== undefined ? req.body.shortDescription : blog.shortDescription,
        description: req.body.description !== undefined ? req.body.description : blog.description,
        featuredImage: imageUrl,
        meta_title: req.body.meta_title !== undefined ? req.body.meta_title : blog.meta_title,
        meta_description: req.body.meta_description !== undefined ? req.body.meta_description : blog.meta_description,
      },
      { new: true }
    );

    return res.status(200).json({ message: "Blog updated successfully", success: true, data: updatedBlog });
  } catch (error) {
    console.error("Error updating blog:", error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found", success: false });
    }
    return res.status(200).json({ message: "Blog deleted successfully", success: true, data: blog });
  } catch (error) {
    console.error("Error deleting blog:", error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};
