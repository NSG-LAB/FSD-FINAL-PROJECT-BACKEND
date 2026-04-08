const express = require('express');
const { Op } = require('sequelize');
const { RenovationProject, Property } = require('../models');
const { Parser } = require('json2csv');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

const SORTABLE_PROJECT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'city',
  'completionPercentage',
  'plannedBudget',
  'spentBudget',
  'expectedValueUplift'
]);

const isAdmin = (req) => req.user?.role === 'admin';

const parseCurrency = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTasks = (tasks = []) => {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .map((task, index) => ({
      id: task.id || `task-${Date.now()}-${index}`,
      title: String(task.title || task.name || '').trim(),
      completed: Boolean(task.completed),
      estimatedCost: parseCurrency(task.estimatedCost)
    }))
    .filter((task) => task.title.length > 0);
};

const completionFromTasks = (tasks = []) => {
  if (!tasks.length) {
    return 0;
  }

  const completed = tasks.filter((task) => task.completed).length;
  return Number(((completed / tasks.length) * 100).toFixed(1));
};

const appendTimelinePoint = (timeline, data) => {
  const next = Array.isArray(timeline) ? [...timeline] : [];
  next.push({
    date: data.date || new Date().toISOString(),
    completionPercentage: Number(data.completionPercentage || 0),
    expectedValueUplift: parseCurrency(data.expectedValueUplift),
    spentBudget: parseCurrency(data.spentBudget),
    note: data.note || ''
  });
  return next;
};

const ensurePropertyAccess = async (req, propertyId) => {
  const property = await Property.findByPk(propertyId, { attributes: ['id', 'userId'] });
  if (!property) {
    return { ok: false, status: 404, message: 'Property not found' };
  }

  if (!isAdmin(req) && property.userId !== req.user.userId) {
    return { ok: false, status: 403, message: 'Not authorized for this property' };
  }

  return { ok: true, property };
};

const ensureProjectAccess = (req, project) => {
  if (!project) {
    return { ok: false, status: 404, message: 'Renovation project not found' };
  }

  if (!isAdmin(req) && project.userId !== req.user.userId) {
    return { ok: false, status: 403, message: 'Not authorized for this renovation project' };
  }

  return { ok: true };
};

const buildWhereClause = (req, { enforceAdminOnly = false } = {}) => {
  const {
    propertyId,
    status,
    city,
    q,
    startDate,
    endDate,
    minCompletion,
    maxCompletion,
  } = req.query;

  const whereClause = {};

  if (enforceAdminOnly || isAdmin(req)) {
    // Admin can view all projects unless explicitly filtered.
    if (req.query.userId) {
      whereClause.userId = req.query.userId;
    }
  } else {
    whereClause.userId = req.user.userId;
  }

  if (propertyId) {
    whereClause.propertyId = propertyId;
  }

  if (status) {
    whereClause.status = status;
  }

  if (city) {
    whereClause.city = { [Op.like]: `%${city}%` };
  }

  if (q) {
    whereClause[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { city: { [Op.like]: `%${q}%` } }
    ];
  }

  const dateFilters = {};
  if (startDate) {
    dateFilters[Op.gte] = new Date(startDate);
  }
  if (endDate) {
    dateFilters[Op.lte] = new Date(endDate);
  }
  if (Object.keys(dateFilters).length) {
    whereClause.createdAt = dateFilters;
  }

  const completionFilters = {};
  if (minCompletion !== undefined && minCompletion !== '') {
    completionFilters[Op.gte] = Number(minCompletion);
  }
  if (maxCompletion !== undefined && maxCompletion !== '') {
    completionFilters[Op.lte] = Number(maxCompletion);
  }
  if (Object.keys(completionFilters).length) {
    whereClause.completionPercentage = completionFilters;
  }

  return whereClause;
};

const aggregateTimeline = (projects) => {
  const byDate = new Map();

  for (const project of projects) {
    const timeline = Array.isArray(project.progressTimeline) ? project.progressTimeline : [];

    for (const point of timeline) {
      const dateValue = point?.date ? new Date(point.date) : null;
      if (!dateValue || Number.isNaN(dateValue.getTime())) {
        continue;
      }

      const key = dateValue.toISOString().slice(0, 10);
      const existing = byDate.get(key) || {
        date: key,
        spentBudget: 0,
        expectedValueUplift: 0,
        avgCompletion: 0,
        entries: 0
      };

      existing.spentBudget += parseCurrency(point.spentBudget);
      existing.expectedValueUplift += parseCurrency(point.expectedValueUplift);
      existing.avgCompletion += Number(point.completionPercentage || 0);
      existing.entries += 1;

      byDate.set(key, existing);
    }
  }

  return Array.from(byDate.values())
    .map((point) => ({
      date: point.date,
      spentBudget: Number(point.spentBudget.toFixed(2)),
      expectedValueUplift: Number(point.expectedValueUplift.toFixed(2)),
      avgCompletion: point.entries ? Number((point.avgCompletion / point.entries).toFixed(2)) : 0,
      entries: point.entries
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      limit = '20',
      offset,
      page = '1',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedOffset = offset !== undefined
      ? Math.max(parseInt(offset, 10) || 0, 0)
      : (parsedPage - 1) * parsedLimit;
    const effectivePage = offset !== undefined
      ? Math.floor(parsedOffset / parsedLimit) + 1
      : parsedPage;
    const normalizedSortBy = SORTABLE_PROJECT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const normalizedSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereClause = buildWhereClause(req);

    const { count, rows } = await RenovationProject.findAndCountAll({
      where: whereClause,
      include: [
        { association: 'property', attributes: ['id', 'title', 'propertyType', 'location', 'currentValue'] },
        { association: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [[normalizedSortBy, normalizedSortOrder]],
      limit: parsedLimit,
      offset: parsedOffset
    });

    const totalPages = Math.max(Math.ceil(count / parsedLimit), 1);

    return res.json({
      success: true,
      count,
      limit: parsedLimit,
      page: effectivePage,
      totalPages,
      offset: parsedOffset,
      sortBy: normalizedSortBy,
      sortOrder: normalizedSortOrder.toLowerCase(),
      hasMore: parsedOffset + rows.length < count,
      projects: rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export/csv', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const whereClause = buildWhereClause(req, { enforceAdminOnly: true });

    const projects = await RenovationProject.findAll({
      where: whereClause,
      include: [
        { association: 'property', attributes: ['id', 'title', 'propertyType', 'location', 'currentValue'] },
        { association: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const rows = projects.map((project) => {
      const plain = project.get({ plain: true });
      return {
        id: plain.id,
        title: plain.title,
        status: plain.status,
        city: plain.city,
        userName: `${plain.owner?.firstName || ''} ${plain.owner?.lastName || ''}`.trim(),
        userEmail: plain.owner?.email || '',
        propertyTitle: plain.property?.title || '',
        propertyType: plain.property?.propertyType || '',
        plannedBudget: parseCurrency(plain.plannedBudget),
        spentBudget: parseCurrency(plain.spentBudget),
        expectedValueUplift: parseCurrency(plain.expectedValueUplift),
        completionPercentage: Number(plain.completionPercentage || 0),
        totalTasks: Array.isArray(plain.tasks) ? plain.tasks.length : 0,
        completedTasks: Array.isArray(plain.tasks) ? plain.tasks.filter((task) => task.completed).length : 0,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt
      };
    });

    const parser = new Parser({
      fields: [
        'id',
        'title',
        'status',
        'city',
        'userName',
        'userEmail',
        'propertyTitle',
        'propertyType',
        'plannedBudget',
        'spentBudget',
        'expectedValueUplift',
        'completionPercentage',
        'totalTasks',
        'completedTasks',
        'createdAt',
        'updatedAt'
      ]
    });

    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.attachment(`renovation-trackers-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/uplift-vs-spend', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const whereClause = buildWhereClause(req, { enforceAdminOnly: true });

    const projects = await RenovationProject.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    const timeline = aggregateTimeline(projects.map((project) => project.get({ plain: true })));

    const totals = projects.reduce(
      (acc, projectInstance) => {
        const project = projectInstance.get({ plain: true });
        acc.plannedBudget += parseCurrency(project.plannedBudget);
        acc.spentBudget += parseCurrency(project.spentBudget);
        acc.expectedValueUplift += parseCurrency(project.expectedValueUplift);
        acc.avgCompletion += Number(project.completionPercentage || 0);
        return acc;
      },
      {
        projectCount: projects.length,
        plannedBudget: 0,
        spentBudget: 0,
        expectedValueUplift: 0,
        avgCompletion: 0
      }
    );

    const summary = {
      projectCount: totals.projectCount,
      plannedBudget: Number(totals.plannedBudget.toFixed(2)),
      spentBudget: Number(totals.spentBudget.toFixed(2)),
      expectedValueUplift: Number(totals.expectedValueUplift.toFixed(2)),
      avgCompletion: totals.projectCount
        ? Number((totals.avgCompletion / totals.projectCount).toFixed(2))
        : 0
    };

    return res.json({
      success: true,
      summary,
      timeline
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id, {
      include: [
        { association: 'property', attributes: ['id', 'title', 'propertyType', 'location', 'currentValue'] },
        { association: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    return res.json({ success: true, project });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      propertyId,
      title,
      description,
      plannedBudget,
      spentBudget,
      expectedValueUplift,
      status,
      city,
      userGoals,
      tasks,
      startDate,
      targetDate
    } = req.body;

    if (!propertyId || !title) {
      return res.status(400).json({ success: false, message: 'propertyId and title are required' });
    }

    const propertyAccess = await ensurePropertyAccess(req, propertyId);
    if (!propertyAccess.ok) {
      return res.status(propertyAccess.status).json({ success: false, message: propertyAccess.message });
    }

    const normalizedTasks = normalizeTasks(tasks);
    const completionPercentage = completionFromTasks(normalizedTasks);

    const project = await RenovationProject.create({
      propertyId,
      userId: isAdmin(req) && req.body.userId ? req.body.userId : req.user.userId,
      title,
      description,
      plannedBudget: parseCurrency(plannedBudget),
      spentBudget: parseCurrency(spentBudget),
      expectedValueUplift: parseCurrency(expectedValueUplift),
      status: status || 'planning',
      city: city || propertyAccess.property.location?.city || null,
      userGoals: Array.isArray(userGoals) ? userGoals : [],
      tasks: normalizedTasks,
      completionPercentage,
      progressTimeline: appendTimelinePoint([], {
        completionPercentage,
        expectedValueUplift,
        spentBudget,
        note: 'Project initialized'
      }),
      startDate,
      targetDate
    });

    return res.status(201).json({
      success: true,
      message: 'Renovation project created successfully',
      project
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id);
    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const updates = { ...req.body };

    if (updates.tasks) {
      updates.tasks = normalizeTasks(updates.tasks);
      updates.completionPercentage = completionFromTasks(updates.tasks);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'plannedBudget')) {
      updates.plannedBudget = parseCurrency(updates.plannedBudget);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'spentBudget')) {
      updates.spentBudget = parseCurrency(updates.spentBudget);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'expectedValueUplift')) {
      updates.expectedValueUplift = parseCurrency(updates.expectedValueUplift);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'propertyId')) {
      const propertyAccess = await ensurePropertyAccess(req, updates.propertyId);
      if (!propertyAccess.ok) {
        return res.status(propertyAccess.status).json({ success: false, message: propertyAccess.message });
      }
    }

    await project.update(updates);

    return res.json({
      success: true,
      message: 'Renovation project updated successfully',
      project
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.patch('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id);
    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const tasks = normalizeTasks(req.body.tasks);
    const completionPercentage = completionFromTasks(tasks);

    const nextTimeline = appendTimelinePoint(project.progressTimeline, {
      completionPercentage,
      expectedValueUplift: req.body.expectedValueUplift ?? project.expectedValueUplift,
      spentBudget: req.body.spentBudget ?? project.spentBudget,
      note: req.body.note || 'Tasks updated'
    });

    await project.update({
      tasks,
      completionPercentage,
      expectedValueUplift: parseCurrency(req.body.expectedValueUplift ?? project.expectedValueUplift),
      spentBudget: parseCurrency(req.body.spentBudget ?? project.spentBudget),
      progressTimeline: nextTimeline
    });

    return res.json({ success: true, message: 'Tasks updated', project });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.patch('/:id/budget', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id);
    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const spentBudget = parseCurrency(req.body.spentBudget);
    const expectedValueUplift = parseCurrency(req.body.expectedValueUplift ?? project.expectedValueUplift);

    const nextTimeline = appendTimelinePoint(project.progressTimeline, {
      completionPercentage: project.completionPercentage,
      expectedValueUplift,
      spentBudget,
      note: req.body.note || 'Budget updated'
    });

    await project.update({
      spentBudget,
      expectedValueUplift,
      progressTimeline: nextTimeline
    });

    return res.json({ success: true, message: 'Budget updated', project });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/timeline', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id);
    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const nextTimeline = appendTimelinePoint(project.progressTimeline, {
      date: req.body.date,
      completionPercentage: req.body.completionPercentage ?? project.completionPercentage,
      expectedValueUplift: req.body.expectedValueUplift ?? project.expectedValueUplift,
      spentBudget: req.body.spentBudget ?? project.spentBudget,
      note: req.body.note || 'Manual progress update'
    });

    await project.update({ progressTimeline: nextTimeline });

    return res.status(201).json({
      success: true,
      message: 'Timeline entry added',
      progressTimeline: nextTimeline,
      project
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await RenovationProject.findByPk(req.params.id);
    const access = ensureProjectAccess(req, project);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    await project.destroy();
    return res.json({ success: true, message: 'Renovation project deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
