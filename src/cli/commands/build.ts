import path from "path";
import { Pages } from "../../Pages.ts";
import type { Site } from "../../Site.ts";

export const run = async (site: Site, _args: { _: [string] }): Promise<void> => {
  await site.out.clear();

  const pages = await Pages.forSite(site);
  for (const url of pages.urls()) {
    process.stdout.write(`Building page for ${url}...`);
    const page = await pages.page(url);
    if (!page) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    await site.out.writeFile(page.outputPath, page.content);
    process.stdout.write(`Done!\n\tStored in ${page.outputPath}\n`);
  }

  const staticFilesFs = site.pagesRoot.cd("static");
  const staticFiles = await staticFilesFs.ls(true);
  for (const file of staticFiles) {
    if (file.isFile()) {
      await site.out.copyFileFrom(
        staticFilesFs,
        path.join(path.relative(staticFilesFs.path, file.parentPath), file.name),
      );
    }
  }
};
