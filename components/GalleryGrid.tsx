"use client";

import { getImageProps } from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import Lightbox, {
  type RenderSlideContainerProps,
  type SlideImage,
} from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { ViewerLabels } from "@/lib/content";
import { motionDuration, motionEase } from "@/lib/motion";
import { scrollToTop, scrollTop } from "@/lib/scroller";
import { lockScroll } from "@/lib/smooth-scroll";
import { SkeletonImage } from "./SkeletonImage";

export type GalleryPhoto = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

const photoSizes =
  "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 400px) 50vw, 100vw";
const widePhotoSizes = "(min-width: 1280px) 50vw, (min-width: 1024px) 67vw, 100vw";

const plugins = [Counter, Zoom];
const carousel = { finite: true, preload: 2, padding: 0 };
const zoomSettings = { scrollToZoom: true, doubleClickMaxStops: 1 };
const animation = {
  fade: motionDuration,
  swipe: 550,
  navigation: 550,
  easing: {
    fade: motionEase,
    swipe: "cubic-bezier(0.25, 1, 0.5, 1)",
    navigation: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
};

function SlideContainer({ slide, children }: RenderSlideContainerProps) {
  const style =
    slide.width && slide.height
      ? ({
          "--slide-width": `${slide.width}px`,
          "--slide-height": `${slide.height}px`,
          "--slide-ratio": slide.width / slide.height,
        } as CSSProperties)
      : undefined;
  return (
    <>
      {style && (
        <div aria-hidden="true" data-viewer-skeleton className="viewer-skeleton" style={style} />
      )}
      {children}
    </>
  );
}

const render = {
  slideContainer: SlideContainer,
  iconLoading: () => null,
};

const portal = {
  container: { "data-lenis-prevent": "" } as HTMLAttributes<HTMLDivElement>,
};
const noScroll = { disabled: true };

function toSlide(photo: GalleryPhoto): SlideImage {
  const { srcSet = "" } = getImageProps({
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    sizes: "100vw",
  }).props;
  const candidates = srcSet
    .split(", ")
    .map((entry) => {
      const [src, descriptor] = entry.split(" ");
      return { src, width: Number.parseInt(descriptor, 10) };
    })
    .filter((candidate) => candidate.src && candidate.width);
  const smaller = candidates.filter((candidate) => candidate.width < photo.width);
  const original = candidates.find((candidate) => candidate.width >= photo.width);
  const sources = original ? [...smaller, { ...original, width: photo.width }] : smaller;
  const largest = sources.at(-1);
  return {
    src: largest?.src ?? photo.src,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    srcSet: sources.map((source) => ({
      src: source.src,
      width: source.width,
      height: Math.round((source.width * photo.height) / photo.width),
    })),
  };
}

const masonryColumns = [2, 3, 4];
const masonryRowsPerWidth = 100;
const masonryGapRows = 6;
const masonryLevelRows = 30;
const masonryStretchRows = 60;
const maxRowPhotos = 3;
const maxRowRatio = 3;
const rowMaxHeight = "80svh";
const rowGap = "1rem";

type RowLayout = {
  maxWidth: string;
  items: { width: string; sizes: string }[];
};

function ratio(photo: GalleryPhoto) {
  return photo.width / photo.height;
}

function rowLayout(photos: GalleryPhoto[]): RowLayout | undefined {
  if (photos.length > maxRowPhotos) return undefined;
  const total = photos.reduce((sum, photo) => sum + ratio(photo), 0);
  const rows =
    photos.length > 1 && total > maxRowRatio ? [photos.slice(0, 1), photos.slice(1)] : [photos];
  const widths = rows.map((row) => {
    const rowRatio = row.reduce((sum, photo) => sum + ratio(photo), 0);
    return `calc(${rowRatio} * ${rowMaxHeight} + ${row.length - 1} * ${rowGap})`;
  });
  return {
    maxWidth: `min(${widths.join(", ")})`,
    items: rows.flatMap((row) => {
      const rowRatio = row.reduce((sum, photo) => sum + ratio(photo), 0);
      return row.map((photo) => {
        const share = ratio(photo) / rowRatio;
        return {
          width: `calc((100% - ${row.length - 1} * ${rowGap}) * ${share} - 0.5px)`,
          sizes: `(min-width: 768px) ${Math.ceil(share * 100)}vw, 100vw`,
        };
      });
    }),
  };
}

function isWide(photo: GalleryPhoto) {
  return photo.width > photo.height;
}

function masonrySpan(photo: GalleryPhoto, columns: number) {
  const width = columns * masonryRowsPerWidth + (columns - 1) * masonryGapRows;
  return Math.round((width * photo.height) / photo.width) + masonryGapRows;
}

type MasonryCell = { column: string; row: number; span: number };

function placeMasonry(photos: GalleryPhoto[], columns: number) {
  const heights = Array<number>(columns).fill(0);
  const last = Array<number | undefined>(columns).fill(undefined);
  const cells: MasonryCell[] = [];
  const pending = photos.map((_, index) => index);
  let deferred = 0;

  const pairs = () =>
    Array.from({ length: columns - 1 }, (_, start) => ({
      start,
      top: Math.max(heights[start], heights[start + 1]),
      level:
        Math.max(heights[start], heights[start + 1]) - Math.min(...heights) <= masonryLevelRows,
    }));

  const levelBottom = () => {
    const target = Math.max(...heights);
    const stretchable = heights.every(
      (height, column) =>
        height === target || (last[column] !== undefined && target - height <= masonryStretchRows),
    );
    if (!stretchable) return;
    heights.forEach((height, column) => {
      const below = last[column];
      if (below !== undefined) cells[below].span += target - height;
      heights[column] = target;
    });
  };

  while (pending.length > 0) {
    if (
      pending.length > 1 &&
      pending.every((index) => isWide(photos[index])) &&
      !pairs().some((pair) => pair.level)
    ) {
      levelBottom();
    }
    let pick = pending[0];
    if (isWide(photos[pick]) && !pairs().some((pair) => pair.level) && deferred < columns * 2) {
      const narrow = pending.find((index) => !isWide(photos[index]));
      if (narrow !== undefined) {
        pick = narrow;
        deferred += 1;
      }
    }
    pending.splice(pending.indexOf(pick), 1);
    const level = isWide(photos[pick]) ? pairs().filter((pair) => pair.level) : [];

    if (level.length > 0) {
      const span = masonrySpan(photos[pick], 2);
      const { start, top } = level.reduce((best, pair) => (pair.top < best.top ? pair : best));
      for (const column of [start, start + 1]) {
        const below = last[column];
        if (below !== undefined) cells[below].span += top - heights[column];
        heights[column] = top + span;
        last[column] = undefined;
      }
      cells[pick] = { column: `${start + 1} / span 2`, row: top + 1, span };
      deferred = 0;
    } else {
      const span = masonrySpan(photos[pick], 1);
      const column = heights.indexOf(Math.min(...heights));
      cells[pick] = { column: `${column + 1}`, row: heights[column] + 1, span };
      heights[column] += span;
      last[column] = pick;
    }
  }
  return cells;
}

function masonryLayout(photos: GalleryPhoto[]) {
  const layouts = masonryColumns.map((columns) => placeMasonry(photos, columns));
  return photos.map((photo, index) => {
    const style: Record<string, string | number> = {};
    masonryColumns.forEach((columns, layout) => {
      const cell = layouts[layout][index];
      style[`--column-${columns}`] = cell.column;
      style[`--row-${columns}`] = `${cell.row} / span ${cell.span}`;
    });
    return {
      style: style as CSSProperties,
      sizes: isWide(photo) ? widePhotoSizes : photoSizes,
      atTop: layouts.some((layout) => layout[index].row === 1),
    };
  });
}

export function GalleryGrid({ photos, labels }: { photos: GalleryPhoto[]; labels: ViewerLabels }) {
  const [active, setActive] = useState<number>();
  const [zoomed, setZoomed] = useState(false);
  const openedAt = useRef(0);

  const slides = useMemo(() => photos.map(toSlide), [photos]);
  const masonry = useMemo(() => masonryLayout(photos), [photos]);
  const row = useMemo(() => rowLayout(photos), [photos]);

  const lightboxLabels = useMemo(
    () => ({
      Lightbox: labels.label,
      "Photo gallery": labels.photos,
      "{index} of {total}": labels.position,
      Previous: labels.previous,
      Next: labels.next,
      Close: labels.close,
      "Zoom in": labels.zoomIn,
      "Zoom out": labels.zoomOut,
    }),
    [labels],
  );

  const controller = useMemo(
    () => ({ closeOnBackdropClick: !zoomed, preventDefaultWheelY: true }),
    [zoomed],
  );

  const on = useMemo(
    () => ({
      view: ({ index }: { index: number }) =>
        setActive((current) => (current === undefined ? current : index)),
      zoom: ({ zoom }: { zoom: number }) => setZoomed(zoom > 1),
      exiting: () => scrollToTop(openedAt.current),
    }),
    [],
  );

  const close = useCallback(() => setActive(undefined), []);
  const viewerOpen = active !== undefined;

  useEffect(() => {
    if (!viewerOpen) return;
    return lockScroll();
  }, [viewerOpen]);

  function open(index: number) {
    openedAt.current = scrollTop();
    setZoomed(false);
    setActive(index);
  }

  return (
    <>
      <div className="@container">
        <ul
          className={
            row
              ? "mx-auto flex flex-col gap-4 md:max-w-(--row-max-width) md:flex-row md:flex-wrap"
              : "flex flex-col gap-4 min-[25rem]:grid min-[25rem]:auto-rows-(--masonry-row) min-[25rem]:grid-cols-2 min-[25rem]:gap-x-4 min-[25rem]:gap-y-0 min-[25rem]:[--masonry-row:calc((100cqw-1rem)/200)] lg:grid-cols-3 lg:[--masonry-row:calc((100cqw-2rem)/300)] xl:grid-cols-4 xl:[--masonry-row:calc((100cqw-3rem)/400)]"
          }
          style={
            row
              ? ({
                  "--row-max-width": row.maxWidth,
                } as CSSProperties)
              : undefined
          }
        >
          {photos.map((photo, index) => (
            <li
              key={photo.src}
              className={
                row
                  ? "md:w-(--row-width) md:grow"
                  : "min-[25rem]:col-(--column-2) min-[25rem]:row-(--row-2) min-[25rem]:pb-[calc(var(--masonry-row)*6)] lg:col-(--column-3) lg:row-(--row-3) xl:col-(--column-4) xl:row-(--row-4)"
              }
              style={
                row
                  ? ({ "--row-width": row.items[index].width } as CSSProperties)
                  : masonry[index].style
              }
            >
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                  open(index);
                }}
                className={`block w-full cursor-zoom-in transition-opacity hover:opacity-80 ${row ? "" : "min-[25rem]:h-full"}`}
              >
                <SkeletonImage
                  src={photo.src}
                  width={photo.width}
                  height={photo.height}
                  alt={photo.alt}
                  sizes={row ? row.items[index].sizes : masonry[index].sizes}
                  loading={row || masonry[index].atTop ? "eager" : "lazy"}
                  frameClassName={`relative w-full ${row ? "" : "min-[25rem]:h-full"}`}
                  frameStyle={{
                    aspectRatio: `${photo.width} / ${photo.height}`,
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Lightbox
        open={viewerOpen}
        index={active ?? 0}
        close={close}
        slides={slides}
        plugins={plugins}
        carousel={carousel}
        controller={controller}
        zoom={zoomSettings}
        animation={animation}
        render={render}
        noScroll={noScroll}
        portal={portal}
        on={on}
        className="viewer"
        labels={lightboxLabels}
      />
    </>
  );
}
