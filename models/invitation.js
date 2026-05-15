import mongoose from "mongoose";
import slugify from "slugify";

const invitationSchema = new mongoose.Schema(
  {
    bride: {
      type: String,
      required: true,
      trim: true,
    },

    groom: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },

    date: String,
    venue: String,
    whatsapp: String,
    hashtag: String,

    countdown: {
      type: Boolean,
      default: true,
    },

    invitation: {
      type: Boolean,
      default: true,
    },

    blessing: String,

    brideFather: String,
    brideMother: String,
    groomFather: String,
    groomMother: String,

    parentsOrder: {
      type: String,
      enum: [
        "Bride family first",
        "Groom family first",
        "Both families together",
      ],
      default: "Bride family first",
    },

    selectedEvents: [String],

    eventDate: String,
    eventTime: String,
    eventVenue: String,
    eventNotes: String,

    storyEnabled: {
      type: Boolean,
      default: true,
    },

    storyTitle: String,
    story: String,

    galleryEnabled: {
      type: Boolean,
      default: true,
    },

    coverImage: String,
    galleryNote: String,

    infoEnabled: {
      type: Boolean,
      default: true,
    },

    dressCode: String,
    parking: String,
    mapsLink: String,

    rsvpEnabled: {
      type: Boolean,
      default: true,
    },

    rsvpDeadline: String,

    mealPreference: {
      type: Boolean,
      default: true,
    },

    guestQuestions: String,

    musicEnabled: {
      type: Boolean,
      default: false,
    },

    songTitle: String,
    musicLink: String,

    autoplayMusic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

invitationSchema.pre("save",function(){
  if(this.isModified("bride") || this.isModified("groom")){
    this.slug = slugify(`${this.bride}-weds-${this.groom}-${Date.now()}`,{lower:true,strict:true})
  }
  
})

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;