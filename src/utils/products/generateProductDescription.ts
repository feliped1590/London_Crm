export interface GenerateProductDescriptionParams {
  family?: string;
  group?: string;
  subgroup?: string;
  productClass?: string;
  printedName?: string;
}

export function generateProductDescription({
  family,
  group,
  subgroup,
  productClass,
  printedName,
}: GenerateProductDescriptionParams): string {
  const parts: string[] = [];

  if (family) parts.push(family);
  if (group) parts.push(group);
  if (subgroup) parts.push(subgroup);
  if (productClass) parts.push(productClass);
  if (printedName) parts.push(printedName);

  return parts.join(' ');
}
