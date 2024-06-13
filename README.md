# API Brain Cards
Доступні методи:<br>
GET /api/category - отримати список категорій<br>
GET /api/category/{id} - отримати список пар за категорією<br>
DELETE /api/category/{id} - видалити категорію<br>
POST /api/category - додати категорію<br>
    <code>{<br>
       title: {},<br>
       pairs[]?:[[string, string]]<br>
     }<br>
    <br>
PATCH /api/category/{id} - оновити категорію<br>
     {<br>
       title: {},<br>
       pairs[]?:[[string, string]]<br>
     }</code>
