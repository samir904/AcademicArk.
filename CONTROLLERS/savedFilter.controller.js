import SavedFilter from "../MODELS/savedFilterSchema.model.js";
/**
 * ➕ Create saved filter preset
 */
export const createSavedFilter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, filters } = req.body;

    if (!name || !filters) {
      return res.status(400).json({
        success: false,
        message: "Preset name and filters are required"
      });
    }

    const preset = await SavedFilter.create({
      userId,
      name,
      filters
    });

    return res.status(201).json({
      success: true,
      data: preset,
      message: "Filter preset saved"
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Preset name already exists"
      });
    }

    console.error("Create saved filter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save filter preset"
    });
  }
};

/**
 * 📥 Get all saved presets of user
 */
export const getSavedFilters = async (req, res) => {
  try {
    const userId = req.user.id;

    const presets = await SavedFilter.find({ userId })
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: presets
    });
  } catch (error) {
    console.error("Get saved filters error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch saved filters"
    });
  }
};

/**
 * ❌ Delete preset
 */
export const deleteSavedFilter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await SavedFilter.findOneAndDelete({
      _id: id,
      userId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Preset not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Preset deleted"
    });
  } catch (error) {
    console.error("Delete saved filter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete preset"
    });
  }
};

/**
 * ⭐ Mark preset as default
 */
export const setDefaultSavedFilter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Reset previous default
    await SavedFilter.updateMany(
      { userId },
      { isDefault: false }
    );

    const updated = await SavedFilter.findOneAndUpdate(
      { _id: id, userId },
      { isDefault: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Preset not found"
      });
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: "Default preset updated"
    });
  } catch (error) {
    console.error("Set default filter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default preset"
    });
  }
};

/**
 * 📊 Track preset usage (analytics hook)
 */
export const incrementPresetUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await SavedFilter.findOneAndUpdate(
      { _id: id, userId },
      { $inc: { usageCount: 1 } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to track usage"
    });
  }
};