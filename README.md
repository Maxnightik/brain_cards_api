# API Brain Cards

  Доступні методи:
GET /api/category - отримати список категорій
 GET /api/category/{id} - отримати список пар за категорією
 DELETE /api/category/{id} - видалити категорію
 POST /api/category - додати категорію
 {
 title: {},
 pairs[]?:[[string, string]]
 }

 PATCH /api/category/{id} - оновити категорію
            {
              title: {},
              pairs[]?:[[string, string]]
            }

