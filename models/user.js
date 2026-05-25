import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
  },
  email: {
    type: String, 
    required: true,
    unique: true, 
  },  
  password: {
    type: String, 

  },  
  number: {
    type: String,
  },
  googleMyBusinessLink: {
    type: String,
  },
  isVendorAuthenticate: {
    type: Boolean,
    default: false,
  },
  role:{
    type:String,
    enum:["user","admin","vendor"],
    default:"user"
  }
})
const User = mongoose.model("User", userSchema);
export default User;