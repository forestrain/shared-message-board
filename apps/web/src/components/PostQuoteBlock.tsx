import type { QuotedPostBrief } from "../lib/api";
import { quoteDisplayLabel } from "../lib/postQuote";

type PostQuoteBlockProps = {
  quote: QuotedPostBrief;
  /** 首页留言摘要等紧凑场景 */
  compact?: boolean;
};

export default function PostQuoteBlock({ quote, compact = false }: PostQuoteBlockProps) {
  return (
    <div
      className={`post-quote-card${compact ? " post-quote-card--compact" : ""}`}
      role="note"
      aria-label="引用的留言"
    >
      <div className="post-quote-card-head">
        <span className="post-quote-badge">引用留言</span>
        <span className="post-quote-at">{quoteDisplayLabel(quote.author)}</span>
      </div>
      <p className="post-quote-card-body">{quote.content}</p>
    </div>
  );
}
