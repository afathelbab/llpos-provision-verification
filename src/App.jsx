import React, { useState } from 'react';
import './App.css';

// --- API Constants ---
const API_KEY = 'd12c80620bdab6e7f951eef5b32e8fd1';
const ENDPOINT_1_URL = 'https://apitest.lovingloyalty.com/sales-commissions/lookup';
const ENDPOINT_2_URL = 'https://apitest.lovingloyalty.com/sales-commissions/details';


// Safer error extraction from fetch Response
async function extractErrorMessage(response, fallback = 'Request failed') {
  try {
    const json = await response.json();
    return json?.message ?? fallback;
  } catch {
    try {
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

function App() {
  const [cvrNumber, setCvrNumber] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  const [shops, setShops] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [detailedData, setDetailedData] = useState(null);

  
  // --- API: Fetch shops by CVR number ---
  const fetchShops = async () => {
    setError(null);
    setShops(null);
    setSelectedShop(null);
    setDetailedData(null);
    setLoadingList(true);

    try {
      const url = `${ENDPOINT_1_URL}?cvrNumber=${encodeURIComponent(cvrNumber.trim())}`;
      const response = await fetch(url, { headers: { 'api-key': API_KEY } });

      if (!response.ok) {
        const msg = await extractErrorMessage(response, 'Failed to fetch shop data.');
        throw new Error(msg);
      }

      const data = await response.json();
      // Try common shapes first, then fall back
      let shopsArray = [];
      if (Array.isArray(data?.results)) {
        shopsArray = data.results;
      } else if (Array.isArray(data?.shops)) {
        shopsArray = data.shops;
      } else if (Array.isArray(data)) {
        shopsArray = data;
      } else {
        // super defensive fallback: collect object-like children with an id
        shopsArray = Object.values(data || {}).filter(
          (item) => item && typeof item === 'object' && ('id' in item || 'placeId' in item)
        );
      }

      // Normalize id/title/businessName keys a bit if needed
      shopsArray = shopsArray.map((s) => ({
        ...s,
        id: s.id ?? s.placeId ?? s.placeID ?? s.place_id,
        title: s.title ?? s.name ?? s.displayName,
        businessName: s.businessName ?? s.merchantName ?? s.companyName,
      }));

      if (shopsArray.length === 1) {
        handleShopSelect(shopsArray[0]);
      } else {
        setShops(shopsArray);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch shop data.');
    } finally {
      setLoadingList(false);
    }
  };

  // --- API: Fetch detailed data by placeId ---
  const fetchDetailedData = async (placeId) => {
    setError(null);
    setDetailedData(null);
    setLoadingDetails(true);

    try {
      const response = await fetch(`${ENDPOINT_2_URL}/${encodeURIComponent(placeId)}`, {
        headers: { 'api-key': API_KEY },
      });

      if (!response.ok) {
        const msg = await extractErrorMessage(response, 'Failed to fetch detailed data.');
        throw new Error(msg);
      }

      const data = await response.json();

      // Subscriptions may come in multiple shapes: array or keyed object
      const rawSubs =
        data?.['node.subscription'] ??
        data?.subscriptions ??
        data?.subscription ??
        [];

      const subscriptionsArray = Array.isArray(rawSubs)
        ? rawSubs
        : Object.values(rawSubs || {});

// ---- Invoices (array or keyed object, possibly under node) ----
const rawInv = (() => {
  const direct =
    data?.['node.invoice'] ??
    data?.node?.invoice ??
    data?.['node.invoices'] ??
    data?.node?.invoices ??
    data?.invoices ??
    data?.invoice;
  if (direct) return direct;

  // last resort: any key containing "invoice"
  const k = Object.keys(data || {}).find((x) => /invoice/i.test(x));
  return k ? data[k] : [];
})();

const invoicesArray = Array.isArray(rawInv) ? rawInv : Object.values(rawInv || {});

const normalizedInvoices = invoicesArray
  .map((inv) => ({
    ...inv,
    totalAmount: inv.totalAmount ?? inv.total_amount,
    vatAmount: inv.vatAmount ?? inv.vat_amount,
    dueDate: inv.dueDate ?? inv.due_date,
    status: inv.status ?? 'N/A',
    type: inv.type ?? 'N/A',
    account: inv.account ?? 'N/A',
  }))
  .sort((a, b) => Number(b.created ?? 0) - Number(a.created ?? 0));

setDetailedData({
  ...data,
  subscriptions: subscriptionsArray.map((x) => ({
    ...x,
    title: x.title ?? x.name ?? x.displayName,
    amount: x.amount ?? x.value ?? x.price,
  })),
  invoices: normalizedInvoices,
});

    } catch (err) {
      setError(err.message || 'Failed to fetch detailed data.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (cvrNumber?.trim()) {
      fetchShops();
    } else {
      setError('Please enter a CVR number.');
    }
  };

  // Handle shop selection
  const handleShopSelect = (shop) => {
    setSelectedShop(shop);
    if (shop?.id) {
      fetchDetailedData(shop.id);
    } else {
      setError('Selected shop has no valid identifier.');
    }
  };

  // Pretty date rendering with safety
  // Pretty date rendering with safety (supports ISO and Unix seconds/millis)
const renderDate = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  try {
    let ms;
    if (typeof value === 'number') {
      ms = value < 1e12 ? value * 1000 : value; // seconds vs millis
    } else if (/^\d+$/.test(String(value))) {
      const n = Number(value);
      ms = n < 1e12 ? n * 1000 : n;
    } else {
      // ISO or other string
      const d = new Date(String(value));
      if (!isNaN(d)) return d.toLocaleDateString();
      return String(value);
    }
    const d = new Date(ms);
    return isNaN(d) ? String(value) : d.toLocaleDateString();
  } catch {
    return String(value);
  }
};

const money = (n) =>
  (n === null || n === undefined || n === '') ? 'N/A' : Number(n).toLocaleString('en-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


  return (
    <div className="App">
      <header className="App-header">
        <h1>LLPOS Sales Commission Verification</h1>
      </header>

      <div className="main-content">
        <div className="input-section">
          <h2>Enter CVR Number</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={cvrNumber}
              onChange={(e) => setCvrNumber(e.target.value)}
              placeholder="e.g., 12345678"
              inputMode="numeric"
              autoComplete="off"
            />
            <button type="submit" disabled={loadingList || loadingDetails}>
              {loadingList ? 'Searching…' : 'Search'}
            </button>
          </form>
        </div>

        {(loadingList || loadingDetails) && (
          <div className="loading">Loading…</div>
        )}

        {error && <div className="error">{error}</div>}

        {/* --- Display shop results --- */}
        {!loadingList && !selectedShop && Array.isArray(shops) && (
          <div className="results-section">
            <h2>Shops Found for CVR: {cvrNumber}</h2>
            {shops.length > 0 ? (
              <table className="shop-table">
                <thead>
                  <tr>
                    <th>Place ID</th>
                    <th>Title</th>
                    <th>Business Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop, idx) => (
                    <tr key={shop.id ?? `shop-${idx}`}>
                      <td>{shop.id ?? 'N/A'}</td>
                      <td>{shop.title || 'N/A'}</td>
                      <td>{shop.businessName || 'N/A'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleShopSelect(shop)}
                          disabled={loadingDetails}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No shop results found for this CVR number.</p>
            )}
          </div>
        )}

        {/* --- Display detailed data --- */}
        {!loadingDetails && selectedShop && detailedData && (
          <div className="detailed-data-section">
            <h2>
              Data for {selectedShop?.title || selectedShop?.businessName || 'Selected Shop'}
            </h2>

            {/* NEW: Display Place ID, Title, and Business Name */}
            <p><strong>Place ID:</strong> {selectedShop.id ?? 'N/A'}</p>
            <p><strong>Title:</strong> {selectedShop.title || 'N/A'}</p>
            <p><strong>Business Name:</strong> {selectedShop.businessName || 'N/A'}</p>

            <hr/> {/* Add a separator for better readability */}

            <p>
              <strong>Binding Period:</strong>{' '}
              {detailedData.bindingPeriod ?? 'N/A'} months
            </p>
            <p>
              <strong>EU Commission:</strong>{' '}
              {detailedData.euCommission ?? 'N/A'}
            </p>
            <p>
              <strong>Contract Start:</strong>{' '}
              {renderDate(detailedData.contractStart)}
            </p>

            <h3>Subscriptions</h3>
            {(detailedData?.subscriptions?.length ?? 0) > 0 ? (
              <ul>
                {detailedData.subscriptions.map((item, idx) => (
                  <li key={idx}>
                    <strong>{item.title || 'N/A'}</strong>: {item.amount ?? 'N/A'} DKK
                  </li>
                ))}
              </ul>
            ) : (
              <p>No subscriptions found.</p>
            )}
            <h3 style={{ marginTop: '1rem' }}>Invoices</h3>
{(detailedData?.invoices?.length ?? 0) > 0 ? (
  <table className="shop-table">
    <thead>
      <tr>
        <th>Invoice ID</th>
        <th>Type</th>
        <th>Account</th>
        <th>Status</th>
        <th>Total (DKK)</th>
        <th>VAT</th>
        <th>Due Date</th>
        <th>Created</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>
      {detailedData.invoices.map((inv) => (
        <tr key={inv.id}>
          <td>{inv.id}</td>
          <td>{inv.type || 'N/A'}</td>
          <td>{inv.account || 'N/A'}</td>
          <td>{inv.status || 'N/A'}</td>
          <td>{inv.totalAmount ?? 'N/A'}</td>
          <td>{inv.vatAmount ?? 'N/A'}</td>
          <td>{renderDate(inv.dueDate)}</td>
          <td>{renderDate(inv.created)}</td>
          <td>{renderDate(inv.updated)}</td>
        </tr>
      ))}
    </tbody>
  </table>
) : (
  <p>No invoices found.</p>
)}



            <div style={{ marginTop: '1rem' }}>
              <button type="button" onClick={() => {
                setSelectedShop(null);
                setDetailedData(null);
                setError(null);
              }}>
                Back to results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;