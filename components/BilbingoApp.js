'use client';

import { useEffect, useMemo, useState } from 'react';
import CrudTable from '@/components/CrudTable';
import { supabase } from '@/lib/supabase/client';

const AGE_LABELS = {
  both: 'Båda',
  children: 'Barn',
  adult: 'Vuxen',
};

function shuffleArray(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export default function BilbingoApp() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeView, setActiveView] = useState('items');
  const [itemAges, setItemAges] = useState(['both']);
  const [gridSize, setGridSize] = useState(5);
  const [rowRules, setRowRules] = useState([]);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) await loadData(data.session.user.id);
      setLoading(false);
    };

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) loadData(newSession.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setRowRules((current) => Array.from({ length: gridSize }, (_, index) => current[index] || { rule: 'random', category: '' }))
  }, [gridSize]);

  const toggleAgeSelection = (age) => {
    setItemAges((current) => (current.includes(age) ? current.filter((value) => value !== age) : [...current, age]));
  };

  const loadData = async (userId) => {
    const [{ data: categoryData }, { data: itemData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    ]);

    setCategories(categoryData || []);
    setItems(itemData || []);
    setRowRules(Array.from({ length: gridSize }, () => ({ rule: 'random', category: '' })));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    if (authMode === 'sign-up') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  const handleAddCategory = async (draft) => {
    if (!session?.user || !draft?.name?.trim()) return;
    await supabase.from('categories').insert([{ user_id: session.user.id, name: draft.name.trim() }]);
    await loadData(session.user.id);
  };

  const handleUpdateCategory = async (categoryId, draft) => {
    if (!session?.user || !draft?.name?.trim()) return;
    await supabase.from('categories').update({ name: draft.name.trim() }).eq('id', categoryId);
    await loadData(session.user.id);
  };

  const handleAddItem = async (draft) => {
    if (!session?.user || !draft?.text?.trim()) return;
    await supabase.from('items').insert([
      {
        user_id: session.user.id,
        text: draft.text.trim(),
        age: draft.age || 'both',
        category_ids: Array.isArray(draft.category_ids) ? draft.category_ids : [],
      },
    ]);
    await loadData(session.user.id);
  };

  const handleUpdateItem = async (itemId, draft) => {
    if (!session?.user || !draft?.text?.trim()) return;
    await supabase.from('items').update({
      text: draft.text.trim(),
      age: draft.age || 'both',
      category_ids: Array.isArray(draft.category_ids) ? draft.category_ids : [],
    }).eq('id', itemId);
    await loadData(session.user.id);
  };

  const handleDeleteItem = async (itemId) => {
    if (!session?.user) return;
    await supabase.from('items').delete().eq('id', itemId);
    await loadData(session.user.id);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!session?.user) return;
    await supabase.from('categories').delete().eq('id', categoryId);
    await loadData(session.user.id);
  };

  const handleGenerate = () => {
    const selectedAges = itemAges.length ? itemAges : ['both', 'children', 'adult'];
    const filtered = items.filter((item) => selectedAges.includes(item.age || 'both'));
    const boardSize = gridSize * gridSize;

    if (!filtered.length) {
      setBoard([]);
      return;
    }

    if (filtered.length < boardSize) {
      setBoard([]);
      alert(`Det finns bara ${filtered.length} bingoföremål för urvalet. Du behöver minst ${boardSize} för en ${gridSize} x ${gridSize}-bricka.`);
      return;
    }

    const boardItems = [];
    const used = new Set();

    for (let rowIndex = 0; rowIndex < gridSize; rowIndex += 1) {
      const rule = rowRules[rowIndex] || { rule: 'random', category: '' };
      const candidates = filtered.filter((item) => !used.has(item.id));
      const categoryCandidates = rule.rule === 'single-category' && rule.category
        ? candidates.filter((item) => (Array.isArray(item.category_ids) ? item.category_ids : []).includes(rule.category))
        : [];
      const source = categoryCandidates.length >= gridSize ? categoryCandidates : candidates;
      const picks = shuffleArray(source).slice(0, gridSize);

      picks.forEach((item) => used.add(item.id));
      boardItems.push(...picks);
    }

    if (boardItems.length < boardSize) {
      setBoard([]);
      alert(`Kunde inte skapa en komplett ${gridSize} x ${gridSize}-bricka med unika bingoföremål.`);
      return;
    }

    setBoard(boardItems);
  };

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category.name])), [categories]);

  const toggleCategoryIds = (currentIds, categoryId) => {
    const normalized = Array.isArray(currentIds) ? currentIds : [];
    return normalized.includes(categoryId) ? normalized.filter((id) => id !== categoryId) : [...normalized, categoryId];
  };

  const normalizeCategoryIds = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
      }
    }
    return [value];
  };

  const getCategoryNames = (item) => normalizeCategoryIds(item.category_ids)
    .map((categoryId) => categoryMap[categoryId])
    .filter(Boolean)
    .join(', ') || 'Ingen kategori';

  const renderItemFormFields = (draft, setDraft) => (
    <>
      <input value={draft.text ?? ''} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="Skriv ett bingoföremål" required />
      <select value={draft.age ?? 'both'} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))}>
        <option value="both">Båda</option>
        <option value="children">Barn</option>
        <option value="adult">Vuxen</option>
      </select>
      <div className="checkbox-list">
        {categories.map((category) => (
          <label key={category.id} className="small checkbox-pill">
            <input type="checkbox" checked={normalizeCategoryIds(draft.category_ids).includes(category.id)} onChange={() => setDraft((current) => ({ ...current, category_ids: toggleCategoryIds(current.category_ids, category.id) }))} />
            {category.name}
          </label>
        ))}
      </div>
    </>
  );

  const renderCategoryFormFields = (draft, setDraft) => (
    <input value={draft.name ?? ''} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ny kategori" required />
  );

  const itemColumns = [
    {
      key: 'text',
      label: 'Föremål',
      sortable: true,
      renderValue: (row) => row.text,
      renderEditor: (draft, setDraft) => (
        <input value={draft.text ?? ''} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="Föremål" required />
      ),
    },
    {
      key: 'categories',
      label: 'Kategorier',
      sortable: true,
      sortValue: (row) => getCategoryNames(row),
      renderValue: (row) => getCategoryNames(row),
      renderEditor: (draft, setDraft) => (
        <div className="checkbox-list">
          {categories.map((category) => (
            <label key={category.id} className="small checkbox-pill">
              <input type="checkbox" checked={normalizeCategoryIds(draft.category_ids).includes(category.id)} onChange={() => setDraft((current) => ({ ...current, category_ids: toggleCategoryIds(current.category_ids, category.id) }))} />
              {category.name}
            </label>
          ))}
        </div>
      ),
    },
  ];

  const categoryColumns = [
    {
      key: 'name',
      label: 'Kategori',
      sortable: true,
      renderValue: (row) => row.name,
      renderEditor: (draft, setDraft) => (
        <input value={draft.name ?? ''} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Kategori" required />
      ),
    },
  ];

  if (loading) return <main><div className="container"><div className="card">Laddar…</div></div></main>;

  if (!session) {
    return (
      <main>
        <div className="container">
          <section className="card hero">
            <h1>Bilbingo</h1>
            <p>En mobilvänlig bingo-app för bilintresserade, byggd med Next.js och Supabase.</p>
            <div className="tabs">
              <button type="button" className={authMode === 'sign-in' ? 'active' : 'secondary'} onClick={() => setAuthMode('sign-in')}>Logga in</button>
              <button type="button" className={authMode === 'sign-up' ? 'active' : 'secondary'} onClick={() => setAuthMode('sign-up')}>Skapa konto</button>
            </div>
            <form className="grid" onSubmit={handleAuthSubmit}>
              <input type="email" placeholder="E-post" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <input type="password" placeholder="Lösenord" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button type="submit">{authMode === 'sign-in' ? 'Logga in' : 'Skapa konto'}</button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="container">
        <section className="card hero">
          <h1>Bilbingo</h1>
          <p>Hantera föremål, kategorier och generera bingobrickor direkt från telefonen.</p>
          <div className="row">
            <button type="button" className={activeView === 'items' ? 'active' : 'secondary'} onClick={() => setActiveView('items')}>Föremål</button>
            <button type="button" className={activeView === 'categories' ? 'active' : 'secondary'} onClick={() => setActiveView('categories')}>Kategorier</button>
            <button type="button" className={activeView === 'generator' ? 'active' : 'secondary'} onClick={() => setActiveView('generator')}>Generator</button>
            <button type="button" className="danger" onClick={() => supabase.auth.signOut()}>Logga ut</button>
          </div>
        </section>

        {activeView === 'items' && (
          <>
            <CrudTable
              title="Föremål"
              rows={items}
              columns={itemColumns}
              emptyMessage="Inga föremål har lagts till ännu."
              addButtonLabel="Lägg till föremål"
              onAdd={handleAddItem}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
              renderAddForm={renderItemFormFields}
              getRowKey={(row) => row.id}
              detailValueFormatter={(key, value) => (key === 'age' ? AGE_LABELS[value] || value : value)}
              detailLabelFormatter={(key) => (key === 'age' ? 'Ålder' : key.replace(/_/g, ' '))}
            />
          </>
        )}

        {activeView === 'categories' && (
          <CrudTable
            title="Kategorier"
            rows={categories}
            columns={categoryColumns}
            emptyMessage="Inga kategorier har lagts till ännu."
            addButtonLabel="Lägg till kategori"
            onAdd={handleAddCategory}
            onUpdate={handleUpdateCategory}
            onDelete={handleDeleteCategory}
            renderAddForm={renderCategoryFormFields}
            getRowKey={(row) => row.id}
          />
        )}

        {activeView === 'generator' && (
          <section className="card grid">
            <h2>Skapa bricka</h2>
            <div className="row">
              <select value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))}>
                <option value={3}>3 x 3</option>
                <option value={4}>4 x 4</option>
                <option value={5}>5 x 5</option>
              </select>
            </div>
            <div className="checkbox-list">
              {Object.entries(AGE_LABELS).map(([value, label]) => (
                <label key={value} className="small checkbox-pill">
                  <input
                    type="checkbox"
                    checked={itemAges.includes(value)}
                    onChange={() => toggleAgeSelection(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid">
              {Array.from({ length: gridSize }, (_, index) => (
                <div key={index} className="row">
                  <select value={rowRules[index]?.rule || 'random'} onChange={(event) => setRowRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, rule: event.target.value } : rule))}>
                    <option value="random">Slumpat</option>
                    <option value="single-category">Kategori per rad</option>
                  </select>
                  <select value={rowRules[index]?.category || ''} onChange={(event) => setRowRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, category: event.target.value } : rule))}>
                    <option value="">Ingen kategori</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button type="button" onClick={handleGenerate}>Generera bricka</button>
            {board.length ? <div className="board" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>{board.map((item, index) => <button key={`${item.id}-${index}`} type="button">{item.text}</button>)}</div> : <p className="muted">Ingen bricka genererad ännu.</p>}
          </section>
        )}
      </div>
    </main>
  );
}
