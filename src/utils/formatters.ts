export function formatVES(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Bs. 0,00';
  return (
    'Bs. ' +
    amount.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatUSD(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$ 0.00 USD';
  return (
    '$ ' +
    amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    ' USD'
  );
}

export function formatUSDShort(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  return '$ ' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getDaysRemainingBadge(vencimientoDateStr?: string) {
  if (!vencimientoDateStr) {
    return { text: 'Al día', type: 'green' };
  }
  const today = new Date().toISOString().split('T')[0];
  const target = new Date(vencimientoDateStr);
  const cur = new Date(today);
  const diffTime = target.getTime() - cur.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Vencido hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'}`,
      days: diffDays,
      type: 'red',
    };
  } else if (diffDays === 0) {
    return { text: 'Vence HOY', days: 0, type: 'red' };
  } else if (diffDays === 1) {
    return { text: 'Falta 1 día', days: 1, type: 'amber' };
  } else if (diffDays <= 7) {
    return { text: `Faltan ${diffDays} días`, days: diffDays, type: 'amber' };
  } else {
    return { text: `Faltan ${diffDays} días`, days: diffDays, type: 'green' };
  }
}
