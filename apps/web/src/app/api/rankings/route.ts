import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const category = searchParams.get('category') || 'all';
  const sortBy = searchParams.get('sortBy') || 'confidence';
  const order = searchParams.get('order') || 'desc';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const offset = (page - 1) * limit;
  
  try {
    let query = supabase
      .from('known_wallets')
      .select('*', { count: 'exact' });
    
    // Filter by category
    if (category !== 'all') {
      query = query.eq('category', category);
    }
    
    // Filter by status
    query = query.eq('status', 'approved');
    
    // Search
    if (search) {
      query = query.or(`label.ilike.%${search}%,twitter_handle.ilike.%${search}%,address.ilike.%${search}%`);
    }
    
    // Sort
    query = query.order(sortBy, { ascending: order === 'asc' });
    
    // Pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      wallets: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
