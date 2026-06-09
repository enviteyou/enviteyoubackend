import Invitation from "../models/invitation.js";
import cloudinary from "../config/cloudinary.js";
import jwt from "jsonwebtoken";

function uploadImageToCloud(file) {
  return new Promise((resolve, reject) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    cloudinary.uploader.upload(
      dataURI,
      {
        folder: "Invitations/gallery",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
  });
}

/**
 * @description Create a new wedding invitation
 */
export const createInvitation = async (req,res)=>{
try {
  const payload = {
    ...req.body,
    createdBy: req.user?.id || req.body?.createdBy || req.body?.userId || req.body?.objectId || req.body?.creatorId,
    grandparentsEnabled: Boolean(req.body?.grandparentsEnabled),
    parentsOrder:
      req.body?.parentsOrder === "Groom family first"
        ? "Groom's family first"
        : req.body?.parentsOrder === "Bride family first"
          ? "Bride's family first"
          : req.body?.parentsOrder,
  };

  const authToken = req.cookies?.customerAccessToken;
  if (!payload.createdBy && authToken) {
    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      payload.createdBy = decoded?.id || payload.createdBy;
    } catch (tokenError) {
      console.log("Unable to decode customer token for invitation creator:", tokenError.message);
    }
  }

  // If infoCards passed as plain object, ensure it's stored as map-compatible
  if (req.body?.infoCards && typeof req.body.infoCards === 'object') {
    payload.infoCards = req.body.infoCards;
  }

  const invitation = await Invitation.create(payload);
  const invitationurl = `https://envite.com/invitations/${invitation.slug}`;
  res.status(201).json({
    message:"Invitation created successfully",
    success:true,
    data:invitation,
    url:invitationurl
  }) 
} catch (error) {
  console.log("Error creating invitation:", error.message);
  res.status(400).json({
    success:false,
    message:error.message
  })
}
}
/**
 * @description Get an invitation by slug
 */
export const getInvitationBySlug = async (req,res)=>{
  try {
    const invitation = await Invitation.findOne({slug:req.params.slug}).populate("createdBy", "name email");
    if(!invitation){
      return res.status(404).json({
        success:false,
        message:"Invitation not found"
      })
    }
    res.status(200).json({
      success:true,
      data:invitation
    })
  } catch (error) {
    res.status(400).json({
      success:false,
      message:error.message
    })
  }
}

/**
 * @description Get an invitation by id
 */
export const getInvitationById = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id).populate("createdBy", "name email");
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @description Get all invitations created by the logged-in user
 */
export const getMyInvitations = async (req, res) => {
  try {
    const creatorId = req.user?.id;
    if (!creatorId) {
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    const customerToken = req.cookies?.customerAccessToken;
    const vendorToken = req.cookies?.vendorAccessToken;
    const userIds = [creatorId];

    if (customerToken) {
      try {
        const decoded = jwt.verify(customerToken, process.env.JWT_SECRET);
        if (decoded.id && !userIds.includes(decoded.id)) {
          userIds.push(decoded.id);
        }
      } catch (e) {}
    }
    if (vendorToken) {
      try {
        const decoded = jwt.verify(vendorToken, process.env.JWT_SECRET);
        if (decoded.id && !userIds.includes(decoded.id)) {
          userIds.push(decoded.id);
        }
      } catch (e) {}
    }

    const invitations = await Invitation.find({ createdBy: { $in: userIds } }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invitations.length,
      data: invitations,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadGalleryImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });
    const result = await uploadImageToCloud(req.file);
    return res.status(200).json({ success: true, secure_url: result.secure_url, url: result.secure_url });
  } catch (error) {
    console.log("Error uploading gallery image:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};