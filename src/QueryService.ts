import { BaseModel } from "./BaseModel";

function toString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function toInt(value: unknown): number | undefined {
  const str = toString(value);
  if (!str) return undefined;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeFilters(filters: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined)
  );
}

function filterBySearch(items: any[], search?: string) {
  if (!search) return items;
  /* v8 ignore start */
  const term = search.toLowerCase();
  const filtered = items.filter((item: any) =>
    Object.values(item).some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(term)
    )
  );
  /* v8 ignore stop */
  return filtered;
}

export class QueryService<M extends typeof BaseModel> {
  private model: M;
  private pageSize: number;

  constructor(model: M, pageSize = 10) {
    this.model = model;
    this.pageSize = pageSize;
  }

  public async list(queryParams: Record<string, unknown>) {
    const {
      cursor: cursorParam,
      pageSize: pageSizeParam,
      limit: limitParam,
      page: pageParam,
      sortField: sortFieldParam,
      sortDir: sortDirParam,
      q: qParam,
      search: searchParam,
      sort: sortParam,
      dir: dirParam,
      ...rawFilters
    } = queryParams;

    const cursor = toString(cursorParam);
    const limitFromParam = toInt(limitParam);
    const pageSizeFromParam = toInt(pageSizeParam);
    const effectiveLimit = limitFromParam ?? pageSizeFromParam ?? this.pageSize;
    const limit = effectiveLimit > 0 ? effectiveLimit : this.pageSize;
    const pageNum = toInt(pageParam) ?? 1;
    const sortField = toString(sortFieldParam) ?? toString(sortParam);
    const sortDir =
      (toString(sortDirParam) ?? toString(dirParam)) === "desc" ? "desc" : "asc";
    const search = toString(qParam) ?? toString(searchParam);
    const filters = normalizeFilters(rawFilters);
    const hasFilters = Object.keys(filters).length > 0;

    const listIndex = (this.model as any).listIndex as string | undefined;
    if (!hasFilters && listIndex && !sortField && !search) {
      const staticFacets =
        ((this.model as any).listIndexStatic as Record<string, unknown>) || {};
      return (this.model.entity as any).query[listIndex](staticFacets).go({
        cursor,
        limit,
      });
    }

    if (!sortField && !search) {
      if (hasFilters) {
        return this.model.match(filters as Record<string, unknown>, cursor, limit);
      }
      return this.model.list(cursor, limit);
    }

    let items = hasFilters
      ? await this.model.matchAll(filters as Record<string, unknown>)
      : await this.model.listAll();

    items = filterBySearch(items, search);

    if (sortField) {
      /* v8 ignore start */
      items = items.sort((a: any, b: any) => {
        const av = (a ?? {})[sortField];
        const bv = (b ?? {})[sortField];
        if (av === bv) return 0;
        if (av === undefined) return sortDir === "asc" ? -1 : 1;
        if (bv === undefined) return sortDir === "asc" ? 1 : -1;
        return av > bv
          ? sortDir === "asc"
            ? 1
            : -1
          : sortDir === "asc"
            ? -1
            : 1;
      });
      /* v8 ignore stop */
    }

    const start = (pageNum - 1) * limit;
    const pageItems = items.slice(start, start + limit);
    const next =
      start + limit < items.length ? String(pageNum + 1) : undefined;

    return { data: pageItems, cursor: next };
  }

  public async count(queryParams: Record<string, unknown>) {
    const {
      sortField: sortFieldParam,
      sort: sortParam,
      sortDir: sortDirParam,
      dir: dirParam,
      q: qParam,
      search: searchParam,
      cursor: _cursor,
      pageSize: _pageSize,
      limit: _limit,
      page: _page,
      ...rawFilters
    } = queryParams;

    const sortField = toString(sortFieldParam) ?? toString(sortParam);
    const sortDir =
      (toString(sortDirParam) ?? toString(dirParam)) === "desc" ? "desc" : "asc";
    const search = toString(qParam) ?? toString(searchParam);
    const filters = normalizeFilters(rawFilters);
    const hasFilters = Object.keys(filters).length > 0;

    if (!sortField && !search) {
      const total = await this.model.count(
        hasFilters ? (filters as Record<string, unknown>) : {}
      );
      return { total };
    }

    let items = hasFilters
      ? await this.model.matchAll(filters as Record<string, unknown>)
      : await this.model.listAll();

    items = filterBySearch(items, search);

    if (sortField) {
      /* v8 ignore start */
      items = items.sort((a: any, b: any) => {
        const av = (a ?? {})[sortField];
        const bv = (b ?? {})[sortField];
        if (av === bv) return 0;
        if (av === undefined) return sortDir === "asc" ? -1 : 1;
        if (bv === undefined) return sortDir === "asc" ? 1 : -1;
        return av > bv
          ? sortDir === "asc"
            ? 1
            : -1
          : sortDir === "asc"
            ? -1
            : 1;
      });
      /* v8 ignore stop */
    }

    return { total: items.length };
  }
}
