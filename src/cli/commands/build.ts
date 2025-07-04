import path from "path";
import { stringOrThrow } from "../../PageData.js";
import { Site } from "../../Site.js";

export const run = async (site: Site, _args: { _: [string] }): Promise<void> => {
  await import("@nodejs-loaders/tsx");

  await site.out.clear();
  await site.pages.init();

  for (const url of site.pages.urls()) {
    process.stdout.write(`Building page for ${url}...`);
    const page = await site.pages.page(url);
    if (!page) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    const outputPath = stringOrThrow(page.outputPath, "output path");
    const content = stringOrThrow(page.content, "content");

    await site.out.writeFile(outputPath, content);
    process.stdout.write(`Done!\n\tStored in ${outputPath}\n`);
  }

  const staticFiles = await site.static.ls(true);
  for (const file of staticFiles) {
    if (file.isFile()) {
      await site.out.copyFileFrom(site.static, path.join(path.relative(site.static.path, file.parentPath), file.name));
    }
  }
};
