export const extractYouTubeId = (url = "") => {
  // supports: https://www.youtube.com/watch?v=ID or https://youtu.be/ID
  const regex =
    /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

export const buildYouTubeEmbedUrl = (videoId) =>
  `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

export const buildYouTubeThumbnailUrl = (videoId) =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
