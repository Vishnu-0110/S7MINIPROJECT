import { parsePagination, paginationPayload } from "../utils/pagination.js";
import { ok } from "../utils/apiResponse.js";

export function createCrudController(Model, searchable = []) {
  return {
    list: async (req, res) => {
      const { page, limit, skip } = parsePagination(req.query);
      const query = {};

      for (const [key, value] of Object.entries(req.query)) {
        if (!["page", "limit", "search"].includes(key) && value) query[key] = value;
      }

      if (req.query.search && searchable.length) {
        query.$or = searchable.map((field) => ({ [field]: { $regex: req.query.search, $options: "i" } }));
      }

      const [data, total] = await Promise.all([
        Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Model.countDocuments(query)
      ]);
      return ok(res, "List", data, 200, { pagination: paginationPayload(page, limit, total) });
    },
    get: async (req, res) => ok(res, "Details", await Model.findById(req.params.id)),
    create: async (req, res) => ok(res, "Created", await Model.create(req.body), 201),
    update: async (req, res) => ok(res, "Updated", await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })),
    remove: async (req, res) => ok(res, "Deleted", await Model.findByIdAndDelete(req.params.id))
  };
}
