import { useBanner } from "@/hooks/use-banner";

export function Banner() {
  const { data: banner } = useBanner();

  if (!banner || !banner.isActive) {
    return null;
  }

  return (
    <a
      href={banner.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full max-w-4xl mx-auto mb-6 rounded-2xl overflow-hidden hover:opacity-90 transition-opacity"
      data-testid="banner-link"
    >
      <img
        src={banner.imageUrl}
        alt="Banner"
        className="w-full h-auto object-cover"
        data-testid="banner-image"
      />
    </a>
  );
}
