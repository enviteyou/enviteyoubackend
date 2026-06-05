import Review from "../models/review.js";
import User from "../models/user.js";

// Helper to calculate initials from a name
const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Seeding function for demo reviews
const seedDemoReviews = async () => {
  const demoReviews = [
    {
      name: "Priyanka Patel",
      initials: "PP",
      verified: true,
      rating: 5,
      title: "Absolutely stunning designs!",
      body: "I used EnviteYou for my wedding invitations, and our guests couldn't stop praising the elegant look. The customization process was seamless.",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      name: "Aarav Sharma",
      initials: "AS",
      verified: true,
      rating: 5,
      title: "Best digital invitation platform",
      body: "Highly professional themes, superb user experience. Setting up RSVP tracking was extremely simple. Saved us a lot of printing costs!",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Sarah Jenkins",
      initials: "SJ",
      verified: true,
      rating: 5,
      title: "Perfect for our destination wedding",
      body: "The themes are modern and customizable. Support was responsive when I wanted to add a custom venue map. Will definitely use it again!",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Rajesh Iyer",
      initials: "RI",
      verified: true,
      rating: 4,
      title: "Excellent templates & easy to edit",
      body: "Very quick setup for my daughter's Upanayan. The interface is intuitive, and the template quality is top-notch.",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Chloe Dupont",
      initials: "CD",
      verified: true,
      rating: 5,
      title: "Exquisite aesthetics!",
      body: "Beautiful fonts and premium layouts. My friends loved the music integration and transition animations.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Vikram Malhotra",
      initials: "VM",
      verified: true,
      rating: 5,
      title: "Highly recommended for corporate events",
      body: "We utilized their templates for our annual gala dinner. Elegant, responsive, and easy to share via WhatsApp. Highly professional.",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    },
    {
      name: "David Miller",
      initials: "DM",
      verified: true,
      rating: 5,
      title: "Outstanding customizer",
      body: "The template customizer is extremely flexible. It works like magic on mobile as well. The RSVP management dashboard is a huge bonus.",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      name: "Aditi Rao",
      initials: "AR",
      verified: true,
      rating: 4,
      title: "Great experience overall",
      body: "Loved the range of designs. A minor alignment issue was resolved quickly. Very happy with the final outcome.",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      name: "Yuki Tanaka",
      initials: "YT",
      verified: true,
      rating: 5,
      title: "Minimalist and beautiful templates",
      body: "The clean designs matched our aesthetic perfectly. Very simple dashboard and smooth sharing features.",
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    },
    {
      name: "Hans Schmidt",
      initials: "HS",
      verified: true,
      rating: 5,
      title: "Impressive quality and performance",
      body: "The digital invites load instantly. Music integration and navigation link setup worked perfectly. Highly recommended!",
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  ];

  await Review.insertMany(demoReviews);
  console.log("Seeded default demo reviews.");
};

/**
 * @desc    Get all reviews and calculate statistics
 * @route   GET /reviews
 * @access  Public
 */
export const getReviews = async (req, res) => {
  try {
    let count = await Review.countDocuments();
    if (count === 0) {
      await seedDemoReviews();
      count = await Review.countDocuments();
    }

    const reviews = await Review.find().sort({ createdAt: -1 });

    // Calculate statistics
    let totalRating = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((review) => {
      totalRating += review.rating;
      if (starCounts[review.rating] !== undefined) {
        starCounts[review.rating]++;
      }
    });

    const averageRating = count > 0 ? (totalRating / count).toFixed(2) : "5.00";

    // Format statistics rows
    const ratingRows = [5, 4, 3, 2, 1].map((stars) => {
      const starCount = starCounts[stars] || 0;
      const percent = count > 0 ? Math.round((starCount / count) * 100) : 0;
      return {
        stars,
        label: `${stars} star${stars > 1 ? "s" : ""}`,
        count: starCount,
        percent,
      };
    });

    res.status(200).json({
      success: true,
      reviews,
      stats: {
        averageRating: parseFloat(averageRating),
        totalReviews: count,
        ratingRows,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * @desc    Submit a new review
 * @route   POST /reviews
 * @access  Private (Logged-in users)
 */
export const createReview = async (req, res) => {
  try {
    const { rating, title, body } = req.body;

    if (!rating || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "Rating, title, and body are required",
      });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    // Fetch user details from database
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const authorName = user.name || "Anonymous User";
    const initials = getInitials(authorName);

    const newReview = new Review({
      name: authorName,
      initials,
      verified: true,
      rating: numericRating,
      title,
      body,
      user: user._id,
    });

    await newReview.save();

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: newReview,
    });
  } catch (error) {
    console.error("Error creating review:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
