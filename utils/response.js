// ========================================
// SUCCESS
// ========================================

export function ok(
    res,
    data = {}
) {
    res.status(200).json({
        success: true,
        ...data
    });
}

// ========================================
// ERROR
// ========================================

export function fail(
    res,
    status,
    error
) {
    res.status(status).json({
        success: false,
        error
    });
}