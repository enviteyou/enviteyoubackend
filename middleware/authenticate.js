import jwt from "jsonwebtoken"
const authUser = async (req,res,next)=>{
  try {
    const authToken = req.cookies.customerAccessToken;
    if(!authToken){
      return res.status(401).json({message:"No token provided",success:false})
    }
    const decode = jwt.verify(authToken,process.env.JWT_SECRET)
    req.user = decode;
    next()
  } catch (error) {
    console.log("Authenticate error",error.message)
    return res.status(500).json({message:"Internal Server Error",success:false})
  }
}
export default authUser