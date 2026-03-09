import {PortableText, type PortableTextComponents} from "@portabletext/react";
import {urlForSanityImage} from "@/lib/sanity/image";

type BodyImageValue = {
  asset?: {
    _ref?: string;
    url?: string;
  };
  alt?: string;
  caption?: string;
  linkUrl?: string;
  linkTarget?: "_self" | "_blank";
  align?: "left" | "center" | "right";
  wrap?: "none" | "left" | "right";
};

type CalloutBoxValue = {
  text?: string;
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

const components: PortableTextComponents = {
  block: {
    normal: ({children}) => (
      <p className="my-4 px-2 text-[17px] leading-[2.1] text-[var(--ui-text)] sm:px-3">
        {children}
      </p>
    ),
    h2: ({children}) => (
      <h2
        className="mt-12 mb-4 border-b border-zinc-400 pb-3 text-xl font-semibold leading-tight text-[var(--ui-text)] dark:border-zinc-500 sm:text-[1.65rem]"
        style={{fontFamily: "var(--font-mincho-jp), serif"}}
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
      const figureClasses = ["my-6"];
      if (wrap === "left") {
        figureClasses.push("sm:float-left", "sm:mr-4", "sm:mb-2", "sm:max-w-[55%]");
      } else if (wrap === "right") {
        figureClasses.push("sm:float-right", "sm:ml-4", "sm:mb-2", "sm:max-w-[55%]");
      } else if (align === "left") {
        figureClasses.push("mr-auto", "max-w-full");
      } else if (align === "right") {
        figureClasses.push("ml-auto", "max-w-full");
      } else {
        figureClasses.push("mx-auto", "max-w-full");
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
