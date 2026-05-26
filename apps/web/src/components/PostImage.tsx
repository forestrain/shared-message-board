type PostImageProps = {
  src: string;
  alt?: string;
  className?: string;
};

export default function PostImage({ src, alt = "帖子图片", className = "post-image" }: PostImageProps) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={`${className}-link`}>
      <img src={src} alt={alt} className={className} loading="lazy" />
    </a>
  );
}
