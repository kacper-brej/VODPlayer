"use server";

import { getSearchIndex } from "@/lib/searchIndex";

const getSearchIndexAction = async () => getSearchIndex();

export default getSearchIndexAction;
