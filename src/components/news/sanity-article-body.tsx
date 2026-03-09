import {PortableText, type PortableTextComponents} from "@portabletext/react";
import {Children, cloneElement, isValidElement, type ReactNode} from "react";
import {urlForSanityImage} from "@/lib/sanity/image";

type BodyImageValue = {
  asset?: {
    _ref?: string;
    url?: string;
  };
  alt?: string;
  caption?: string;
  displaySize?: "xsmall" | "small" | "medium" | "large" | "full";
  linkUrl?: string;
  linkTarget?: "_self" | "_blank";
  align?: "left" | "center" | "right";
  wrap?: "none" | "left" | "right";
};

type CalloutBoxValue = {
  text?: string;
};

type PortableTextBlockLike = {
  _type?: string;
  children?: Array<{_type?: string; text?: string}>;
};

function resolveImageUrl(value: BodyImageValue) {
  if (typeof value?.asset?.url === "string" && value.asset.url.trim().length > 0) {
    return value.asset.url.trim();
  }
  try {
    const built = urlForSanityImage(value).auto("format").url();
    return typeof built === "string" && built.trim().length > 0 ? built : null;
  } catch {
    return null;
  }
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function getYoutubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return id || null;
  }
  if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") ?? "";
      return id || null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" || segments[0] === "embed") {
      return segments[1] ?? null;
    }
  }
  return null;
}

function getSpotifyEmbedUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host !== "open.spotify.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const type = segments[0];
  const id = segments[1];
  if (!type || !id) return null;
  if (!["track", "album", "playlist", "episode", "show", "artist"].includes(type)) return null;
  return `https://open.spotify.com/embed/${type}/${id}`;
}

function extractPlainTextFromBlock(value: unknown): string {
  const block = (value ?? {}) as PortableTextBlockLike;
  if (!Array.isArray(block.children)) return "";
  return block.children
    .map((child) => (child?._type === "span" && typeof child.text === "string" ? child.text : ""))
    .join("");
}

function renderTextWithAutoLinks(text: string) {
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    const parsed = parseHttpUrl(raw);
    if (parsed) {
      nodes.push(
        <a key={`${start}-${raw}`} href={parsed.toString()} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
          {raw}
        </a>
      );
    } else {
      nodes.push(raw);
    }
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function linkifyNode(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return renderTextWithAutoLinks(node);
  }
  if (!isValidElement(node)) {
    return node;
  }

  const props = node.props as {children?: ReactNode};
  if (!("children" in props)) return node;
  const nextChildren = Children.map(props.children, (child) => linkifyNode(child));
  return cloneElement(node, undefined, nextChildren);
}

const components: PortableTextComponents = {
  block: {
    normal: ({children, value}) => {
      const text = extractPlainTextFromBlock(value);
      const trimmed = text.trim();
      const maybeUrl = trimmed ? parseHttpUrl(trimmed) : null;
      if (maybeUrl) {
        const youtubeId = getYoutubeId(maybeUrl);
        if (youtubeId) {
          return (
            <div className="my-6 overflow-hidden rounded-xl border border-[var(--ui-border)]">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="YouTube video player"
                className="aspect-video w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          );
        }

        const spotifyEmbedUrl = getSpotifyEmbedUrl(maybeUrl);
        if (spotifyEmbedUrl) {
          return (
            <div className="my-6 overflow-hidden rounded-xl border border-[var(--ui-border)]">
              <iframe
                src={spotifyEmbedUrl}
                title="Spotify player"
                className="h-[352px] w-full"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
            </div>
          );
        }
      }

      return (
        <p className="my-4 px-2 text-[17px] leading-[2.1] whitespace-pre-wrap text-[var(--ui-text)] sm:px-3">
          {Children.map(children, (child) => linkifyNode(child))}
        </p>
      );
    },
    h2: ({children}) => (
      <h2
        className="font-mincho-jp mt-12 mb-4 border-b border-zinc-400 pb-3 text-[1.125rem] font-semibold leading-tight text-[var(--ui-text)] dark:border-zinc-500 sm:text-[1.375rem]"
      >
        {children}
      </h2>
    ),
    h3: ({children}) => (
      <h3 className="mt-8 mb-1 inline-block border-b border-zinc-400 pb-0 text-[1rem] font-bold leading-snug text-zinc-900 dark:border-zinc-500 dark:text-zinc-300 sm:text-[1.15rem]">
        {children}
      </h3>
    ),
    blockquote: ({children}) => (
      <blockquote className="my-5 border-l-2 border-[var(--ui-border)] pl-4 text-[var(--ui-text)]">
        {children}
      </blockquote>
    ),
    well3: ({children}) => (
      <div className="well3 my-6 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-4 py-3 text-[17px] leading-[2.1] text-[var(--ui-text)]">
        {children}
      </div>
    ),
  },
  list: {
    bullet: ({children}) => <ul className="my-4 list-disc space-y-2 pl-8 text-[var(--ui-text)]">{children}</ul>,
    number: ({children}) => <ol className="my-4 list-decimal space-y-2 pl-8 text-[var(--ui-text)]">{children}</ol>,
  },
  listItem: ({children}) => <li className="text-[17px] leading-8 text-[var(--ui-text)]">{children}</li>,
  marks: {
    link: ({children, value}) => {
      const href = typeof value?.href === "string" ? value.href : undefined;
      return (
        <a
          href={href}
          target={href?.startsWith("http") ? "_blank" : undefined}
          rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          className="break-all underline underline-offset-2"
        >
          {children}
        </a>
      );
    },
  },
  types: {
    horizontalRule: () => <hr className="my-8 border-0 border-t border-[var(--ui-border)]" />,
    calloutBox: ({value}) => {
      const item = (value ?? {}) as CalloutBoxValue;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) return null;
      return (
        <div className="well3 my-6 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-4 py-3 text-[17px] leading-[2.1] text-[var(--ui-text)]">
          <p className="m-0 whitespace-pre-wrap">{text}</p>
        </div>
      );
    },
    image: ({value}) => {
      const imageValue = (value ?? {}) as BodyImageValue;
      const url = resolveImageUrl(imageValue);
      if (!url) return null;
      const linkUrl =
        typeof imageValue.linkUrl === "string" && imageValue.linkUrl.trim().length > 0
          ? imageValue.linkUrl.trim()
          : null;
      const linkTarget = imageValue.linkTarget === "_blank" ? "_blank" : "_self";
      const linkRel = linkTarget === "_blank" ? "noopener noreferrer" : undefined;

      const wrap = imageValue.wrap ?? "none";
      const align = imageValue.align ?? "center";
      const displaySize = imageValue.displaySize ?? "medium";
      const figureClasses = ["my-6"];

      const floatingWidthBySize: Record<NonNullable<BodyImageValue["displaySize"]>, string> = {
        xsmall: "sm:w-[25%]",
        small: "sm:w-[35%]",
        medium: "sm:w-[55%]",
        large: "sm:w-[70%]",
        full: "sm:w-full",
      };
      const centeredWidthBySize: Record<NonNullable<BodyImageValue["displaySize"]>, string> = {
        xsmall: "max-w-xs",
        small: "max-w-sm",
        medium: "max-w-xl",
        large: "max-w-3xl",
        full: "max-w-full",
      };

      if (wrap === "left") {
        figureClasses.push("sm:float-left", "sm:mr-4", "sm:mb-2", floatingWidthBySize[displaySize], "w-full");
      } else if (wrap === "right") {
        figureClasses.push("sm:float-right", "sm:ml-4", "sm:mb-2", floatingWidthBySize[displaySize], "w-full");
      } else if (align === "left") {
        figureClasses.push("mr-auto", centeredWidthBySize[displaySize], "w-full");
      } else if (align === "right") {
        figureClasses.push("ml-auto", centeredWidthBySize[displaySize], "w-full");
      } else {
        figureClasses.push("mx-auto", centeredWidthBySize[displaySize], "w-full");
      }
      // eslint-disable-next-line @next/next/no-img-element
      const imageElement = (
        <img src={url} alt={imageValue.alt ?? ""} className="h-auto w-full rounded-xl border border-[var(--ui-border)]" />
      );

      return (
        <figure className={figureClasses.join(" ")}>
          {linkUrl ? (
            <a href={linkUrl} target={linkTarget} rel={linkRel}>
              {imageElement}
            </a>
          ) : (
            imageElement
          )}
          {imageValue.caption ? (
            <figcaption className="mt-2 text-xs leading-5 text-[var(--ui-text-subtle)]">{imageValue.caption}</figcaption>
          ) : null}
        </figure>
      );
    },
  },
};

export function SanityArticleBody({value, className}: {value: unknown; className?: string}) {
  if (!Array.isArray(value)) return null;

  return (
    <div
      className={["news-article-body overflow-wrap-anywhere text-[var(--ui-text)] after:block after:clear-both after:content-['']", className]
        .filter(Boolean)
        .join(" ")}
    >
      <PortableText value={value} components={components} />
    </div>
  );
}
