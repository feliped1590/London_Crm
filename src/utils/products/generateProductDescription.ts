export interface GenerateProductDescriptionParams {
  family?: string;
  group?: string;
  subgroup?: string;
  productClass?: string;
  printedName?: string;
  width?: number;
  length?: number;
  thickness?: number;
}

export function generateProductDescription({
  family,
  group,
  subgroup,
  productClass,
  width,
  length,
  thickness,
}: GenerateProductDescriptionParams): string {
  const parts: string[] = [];

  if (family) parts.push(family);
  if (group) parts.push(group);
  if (subgroup) parts.push(subgroup);
  if (productClass) parts.push(productClass);

  const w = Number(width);
  const l = Number(length);
  const t = Number(thickness);

  if (w > 0 && l > 0 && t > 0) {
    parts.push(`${w}x${l}x${t}`);
  }

  return parts.join(' ');
}
