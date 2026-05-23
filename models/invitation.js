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

    templateId: {
      type: String,
      trim: true,
      default: "1",
    },

    nameOrder: {
      type: String,
      enum: ["brideFirst", "groomFirst"],
      default: "brideFirst",
    },

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

    grandparentsEnabled: {
      type: Boolean,
      default: false,
    },

    brideGrandfather: String,
    brideGrandmother: String,
    groomGrandfather: String,
    groomGrandmother: String,

    parentsOrder: {
      type: String,
      enum: [
        "Bride's family first",
        "Groom's family first",
        "Both families together",
        "Bride family first",
        "Groom family first",
      ],
      default: "Bride's family first",
    },

    selectedEvents: [String],

    eventDetails: {
      type: Map,
      of: new mongoose.Schema(
        {
          functionName: String,
          date: String,
          time: String,
          venue: String,
          oneLiner: String,
          mapsLink: String,
        },
        { _id: false },
      ),
      default: {},
    },

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
    personalityAnswers: {
      type: Map,
      of: String,
      default: {},
    },
    generatedTags: String,
    customHashtags: String,
    extraTags: String,
    infoCards: {
      type: Map,
      of: String,
      default: {},
    },

    galleryEnabled: {
      type: Boolean,
      default: true,
    },
    coverImage: String,
    galleryLayout: {
      type: Number,
      default: 4,
    },
    galleryImages: {
      type: [String],
      default: [],
    },
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
  if(this.isModified("bride") || this.isModified("groom") || this.isModified("nameOrder")){
    const firstName = this.nameOrder === "groomFirst" ? this.groom : this.bride;
    const secondName = this.nameOrder === "groomFirst" ? this.bride : this.groom;
    this.slug = slugify(`${firstName}-weds-${secondName}-${Date.now()}`,{lower:true,strict:true})
  }
  
})

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
