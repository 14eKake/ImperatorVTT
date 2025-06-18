/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
  const templatePaths = [
    "systems/imperator/templates/parts/sheet-attributes.html",
    "systems/imperator/templates/parts/sheet-groups.html"
  ];
  return loadTemplates(templatePaths);
};
