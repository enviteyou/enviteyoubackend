import Invitation from "../models/invitation.js";
import cloudinary from "../config/cloudinary.js";

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
    grandparentsEnabled: Boolean(req.body?.grandparentsEnabled),
    parentsOrder:
      req.body?.parentsOrder === "Groom family first"
        ? "Groom's family first"
        : req.body?.parentsOrder === "Bride family first"
          ? "Bride's family first"
          : req.body?.parentsOrder,
  };

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
    const invitation = await Invitation.findOne({slug:req.params.slug});
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