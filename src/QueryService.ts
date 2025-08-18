import { Context } from "hono";
import { BaseModel } from "./BaseModel";

export class QueryService<M extends typeof BaseModel> {
  private model: M;
  private pageSize: number;

  constructor(model: M, pageSize = 10) {
    this.model = model;
    this.pageSize = pageSize;
  }

  public async list(c: Context) {
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
      ...filters
    } = c.req.query() as Record<string, string>;

    const cursor = cursorParam || undefined;
    const limit = limitParam
      ? parseInt(limitParam, 10)
      : pageSizeParam
        ? parseInt(pageSizeParam, 10)
        : this.pageSize;
    const pageNum = pageParam ? parseInt(pageParam, 10) : 1;
    const sortField = sortFieldParam || sortParam;
    const sortDir =
      sortDirParam === "desc" || dirParam === "desc" ? "desc" : "asc";
    const search = qParam || searchParam;
    const hasFilters = Object.keys(filters).length > 0;
    const listIndex = (this.model as any).listIndex as string | undefined;
    if (!hasFilters && listIndex && !sortField && !search) {
      const staticFacets =
        ((this.model as any).listIndexStatic as Record<string, unknown>) || {};
      const idxResult = await (this.model.entity as any).query[listIndex](
        staticFacets
      ).go({ cursor, limit });
      return c.json(idxResult);
    }

    if (!sortField && !search) {
      let result;
      if (hasFilters) {
        result = await this.model.match(
          filters as Record<string, unknown>,
          cursor,
          limit
        );
      } else {
        result = await this.model.list(cursor, limit);
      }
      return c.json(result);
    }

    let items = hasFilters
      ? await this.model.matchAll(filters as Record<string, unknown>)
      : await this.model.listAll();
    if (search) {
      const term = search.toLowerCase();
      items = items.filter((item: any) =>
        Object.values(item).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(term)
        )
      );
    }
    items.sort((a: any, b: any) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av === bv) return 0;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return sortDir === "asc" ? -1 : 1;
    });
    const start = (pageNum - 1) * limit;
    const pageItems = items.slice(start, start + limit);
    const next =
      start + limit < items.length ? String(pageNum + 1) : undefined;
    return c.json({ data: pageItems, cursor: next });
  }

  public async count(c: Context) {
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
      ...filters
    } = c.req.query() as Record<string, string>;
    const sortField = sortFieldParam || sortParam;
    const sortDir =
      sortDirParam === "desc" || dirParam === "desc" ? "desc" : "asc";
    const search = qParam || searchParam;
    const hasFilters = Object.keys(filters).length > 0;

    if (!sortField && !search) {
      const total = await this.model.count(
        hasFilters ? (filters as Record<string, unknown>) : {}
      );
      return c.json({ total });
    }

    let items = hasFilters
      ? await this.model.matchAll(filters as Record<string, unknown>)
      : await this.model.listAll();
    if (search) {
      const term = search.toLowerCase();
      items = items.filter((item: any) =>
        Object.values(item).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(term)
        )
      );
    }
    if (sortField) {
      items.sort((a: any, b: any) => {
        const av = a[sortField];
        const bv = b[sortField];
        if (av === bv) return 0;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return sortDir === "asc" ? -1 : 1;
      });
    }
    return c.json({ total: items.length });
  }
}
