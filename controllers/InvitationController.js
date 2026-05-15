import Invitation from "../models/invitation.js";

/**
 * @description Create a new wedding invitation
 */
export const createInvitation = async (req,res)=>{
try {
  const invitation = await Invitation.create(req.body);
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