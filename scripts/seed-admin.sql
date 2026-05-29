-- ============================================================
-- MVP Basket Sénégal — Script de seed admin
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- APRÈS avoir créé le compte avec email diengbabacar666@gmail.com
-- via l'interface de l'app (/auth)
-- ============================================================

-- 1. Trouver l'ID de l'utilisateur par email et lui donner le rôle admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'diengbabacar666@gmail.com';

-- 2. Si le profil n'existe pas encore (première connexion pas encore faite),
--    le créer manuellement à partir du compte auth
INSERT INTO profiles (id, email, role, display_name, created_at)
SELECT 
  id,
  email,
  'admin',
  'Ababacar Dieng',
  now()
FROM auth.users
WHERE email = 'diengbabacar666@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Ababacar Dieng';

-- 3. Vérifier que ça a fonctionné
SELECT id, email, role, display_name FROM profiles WHERE email = 'diengbabacar666@gmail.com';
