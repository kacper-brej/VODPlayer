"use server";

import { getSearchIndex } from "@/lib/search/searchIndex";

const getSearchIndexAction = async () => getSearchIndex();

export default getSearchIndexAction;
