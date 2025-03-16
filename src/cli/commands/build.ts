import path from "path";
import { stringOrThrow } from "../../PageData.ts";
import type { Site } from "../../Site.ts";

export const run = async (site: Site, _args: { _: [string] }): Promise<void> => {
  await site.out.clear();
  await site.pages.init();

  for (const url of site.pages.urls()) {
    process.stdout.write(`Building page for ${url}...`);
    const page = await site.pages.page(url);
    if (!page) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    const outputPath = stringOrThrow(page.outputPath);
    const content = stringOrThrow(page.content);

    await site.out.writeFile(outputPath, content);
    process.stdout.write(`Done!\n\tStored in ${outputPath}\n`);
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
