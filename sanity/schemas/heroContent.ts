import { defineField, defineType } from "sanity";

export default defineType({
  name: "heroContent",
  title: "Hero Content",
  type: "document",
  fields: [
    defineField({ name: "seasonBadge", title: "Season Badge", type: "string" }),
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "subtitle", title: "Subtitle", type: "text" }),
    defineField({ name: "primaryCtaLabel", title: "Primary CTA Label", type: "string" }),
    defineField({ name: "primaryCtaHref", title: "Primary CTA Href", type: "string" }),
    defineField({ name: "secondaryCtaLabel", title: "Secondary CTA Label", type: "string" }),
    defineField({ name: "secondaryCtaHref", title: "Secondary CTA Href", type: "string" }),
  ],
});
