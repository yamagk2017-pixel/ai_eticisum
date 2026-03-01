import {PortableText, type PortableTextComponents} from "@portabletext/react";

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
      <h3 className="mt-8 mb-1 inline-block border-b border-zinc-400 pb-0 text-[1rem] font-bold leading-snug text-zinc-700 dark:border-zinc-500 dark:text-zinc-300 sm:text-[1.15rem]">
        {children}
      </h3>
    ),
    blockquote: ({children}) => (
      <blockquote className="my-5 border-l-2 border-[var(--ui-border)] pl-4 text-[var(--ui-text)]">
        {children}
      </blockquote>
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
    image: ({value}) => {
      const url = value?.asset?._ref ? undefined : value?.asset?.url;
      if (!url) return null;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt={value?.alt ?? ""} className="my-6 h-auto w-full rounded-xl" />;
    },
  },
};

export function SanityArticleBody({value}: {value: unknown}) {
  if (!Array.isArray(value)) return null;

  return (
    <div className="overflow-wrap-anywhere text-[var(--ui-text)]">
      <PortableText value={value} components={components} />
    </div>
  );
}
