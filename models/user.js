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
    match: [/^\d{10}$/, "Phone number must be exactly 10 digits"],
  },
  googleMyBusinessLink: {
    type: String,
  },
  businessName: {
    type: String,
  },
  gstNumber: {
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